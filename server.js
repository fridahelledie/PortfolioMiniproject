// server.js
// This is the entry point for the whole application.
// Run it with: node server.js
// Then visit: http://localhost:3000

const express = require('express');
const path = require('path');
const db = require('./database/db.js'); // Our database connection (defined separately)

const app = express(); // Create an Express application
const PORT = 3000;

// ---------------------------------------------------------------------------
// MIDDLEWARE
// These are the functions that run on every request before it reaches a route
// ---------------------------------------------------------------------------

// This tells Express to look in the 'public' folder for static files
// (CSS, JS, images). If a request comes in for /css/main.css, Express
// will automatically serve public/css/main.css without needing an explicit route
app.use(express.static(path.join(__dirname, 'public')));

// This lets Express read JSON bodies sent in POST/PUT requests.
// We don't strictly need it now, but I read that it's standard to include
app.use(express.json());

// ---------------------------------------------------------------------------
// PAGE ROUTES
// These routes serve HTML pages when a user navigates to a URL.
// ---------------------------------------------------------------------------

// The home page - serves index.html when the user visits localhost:3000
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Project pages - the :slug part is a URL parameter, like a variable in the URL.
// If the user visits /projects/example-project, then req.params.slug = 'example-project'
// and Express looks for example-project.html in the projects folder.
app.get('/projects/:slug', (req, res) => {
  const filePath = path.join(__dirname, 'projects', `${req.params.slug}.html`);
  res.sendFile(filePath, (err) => {
    // sendFile calls this callback if something goes wrong (e.g. file not found)
    if (err) {
      res.status(404).send('Project not found');
    }
  });
});

// ---------------------------------------------------------------------------
// API ROUTES
// These routes are called by JavaScript on the frontend using fetch().
// They never serve HTML, they return JSON data instead.
// The frontend then uses that data to build/update the page dynamically.
// ---------------------------------------------------------------------------

// GET /api/projects
// Returns a JSON array of projects, optionally filtered by tags and sorted.
//
// Query parameters (all optional):
//   tags - comma-separated list of tags to filter by, e.g. ?tags=web,csharp
//   sort - 'date' or 'name', e.g. ?sort=date
//
// Example call from the frontend:
//   fetch('/api/projects?tags=web&sort=date')

app.get('/api/projects', (req, res) => {
  const { tags, sort } = req.query; // Extract query params from the URL

  // Build the SQL query dynamically based on what filters were requested.
  // We use a JOIN to connect the three tables (projects, tags, project_tags).
  let query;
  let params = [];

  if (tags) {
    // Split the comma-separated tag string into an array
    const tagList = tags.split(',').map(t => t.trim());

    // The '?' placeholders get replaced by the values in params[].
    // This is called a "prepared statement" - it prevents SQL injection attacks
    // by ensuring user input is never directly embedded in the SQL string.
    const placeholders = tagList.map(() => '?').join(', ');

    query = `
      SELECT DISTINCT p.*
      FROM projects p
      JOIN project_tags pt ON p.id = pt.project_id
      JOIN tags t ON pt.tag_id = t.id
      WHERE t.name IN (${placeholders})
    `;
    params = tagList;
  } else {
    // No tag filter - return everything
    query = `SELECT * FROM projects p`;
  }

  // Append ORDER BY clause based on the sort parameter
  if (sort === 'name') {
    query += ` ORDER BY p.title ASC`;
  } else {
    // Default sort: by date (recent first)
    query += ` ORDER BY p.date DESC`;
  }

  // Execute the query. db.prepare().all() runs a SELECT and returns all rows.
  // This is synchronous with better-sqlite3, which keeps things simple.
  const projects = db.prepare(query).all(...params);

  // For each project, also fetch its tags so the frontend can display them on cards
  const projectsWithTags = projects.map(project => {
    const projectTags = db.prepare(`
      SELECT t.name
      FROM tags t
      JOIN project_tags pt ON t.id = pt.tag_id
      WHERE pt.project_id = ?
    `).all(project.id);

    return {
      ...project, // Spread all existing project fields
      tags: projectTags.map(t => t.name) // Add a 'tags' array
    };
  });

  res.json(projectsWithTags); // Send the array as JSON
});


// GET /api/tags
// Returns all unique tags that exist in the database.
// The frontend calls this once on load to build the tag filter buttons.
app.get('/api/tags', (req, res) => {
  const tags = db.prepare(`SELECT name FROM tags ORDER BY name ASC`).all();
  res.json(tags.map(t => t.name)); // Return a simple array of strings: ["design", "web", ...]
});


// ---------------------------------------------------------------------------
// START THE SERVER
// It will be running in the command prompt till you exit with CTRL+C or by closing the window. 
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Portfolio server running at http://localhost:${PORT}`);
  console.log(`Press Ctrl+C to stop.`);
});
