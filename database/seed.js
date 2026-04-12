// database/seed.js
// This script scans every HTML file in the /projects folder, reads their
// <meta> tags to extract project data, and inserts that data into the database.
//
// Run it whenever we add or update a project
//
// It is safe to run multiple times. It uses "upsert" logic (INSERT OR REPLACE)
// so existing projects get updated rather than duplicated.


const fs = require('fs');   // Built-in Node.js module for reading files
const path = require('path');
const db = require('./db.js'); // Our database connection

// ---------------------------------------------------------------------------
// HELPER: Parse meta tags from an HTML string
// ---------------------------------------------------------------------------
// This function takes raw HTML text and extracts the content of a named
// <meta> tag. For example, given:
//   <meta name="project-title" content="My Cool Project">
// calling getMeta(html, 'project-title') returns "My Cool Project".
//
// We use a regular expression to find the pattern.
// The regex looks for: name="project-title" ... content="..." (or vice versa)
function getMeta(html, metaName) {
  // This regex matches a <meta> tag containing name="metaName" and captures
  // the content attribute value. The 'i' flag makes it case-insensitive.
  // I had to use an LLM to help me write this lol. 
  const regex = new RegExp(
    `<meta[^>]+name=["']${metaName}["'][^>]+content=["']([^"']+)["']`,
    'i'
  );
  const match = html.match(regex);
  return match ? match[1].trim() : null;
}

// ---------------------------------------------------------------------------
// HELPER: Derive a URL-friendly "slug" from a filename
// ---------------------------------------------------------------------------
// A slug is the part of the URL that identifies a page.
// e.g. "my-cool-project.html" returns "my-cool-project"
function slugFromFilename(filename) {
  return path.basename(filename, '.html');
}

// ---------------------------------------------------------------------------
// PREPARED STATEMENTS
// We prepare these SQL statements once, then run them many times in the loop.
// Preparing once is more efficient and keeps the loop body clean.
// ---------------------------------------------------------------------------

// INSERT OR REPLACE means: if a project with this slug already exists,
// replace it with the new data. Otherwise, insert it fresh.
// This is the "upsert" pattern, update if exists, insert if not.
const upsertProject = db.prepare(`
  INSERT INTO projects (title, slug, date, thumbnail, summary)
  VALUES (@title, @slug, @date, @thumbnail, @summary)
  ON CONFLICT(slug) DO UPDATE SET
    title = excluded.title,
    date = excluded.date,
    thumbnail = excluded.thumbnail,
    summary = excluded.summary
`);

const insertTag = db.prepare(`
  INSERT OR IGNORE INTO tags (name) VALUES (?)
`);

const getTag = db.prepare(`
  SELECT id FROM tags WHERE name = ?
`);

const getProject = db.prepare(`
  SELECT id FROM projects WHERE slug = ?
`);

const deleteProjectTags = db.prepare(`
  DELETE FROM project_tags WHERE project_id = ?
`);

const insertProjectTag = db.prepare(`
  INSERT OR IGNORE INTO project_tags (project_id, tag_id) VALUES (?, ?)
`);

// ---------------------------------------------------------------------------
// MAIN SEED LOGIC
// ---------------------------------------------------------------------------

const projectsDir = path.join(__dirname, '..', 'projects');

// Read all files in the /projects directory
const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.html'));

if (files.length === 0) {
  console.log('No project HTML files found in /projects. Nothing to seed.');
  process.exit(0);
}

console.log(`Found ${files.length} project file(s). Seeding database...\n`);

// Wrap everything in a transaction, this means all inserts succeed together,
// or none of them do if something goes wrong. Much faster than individual inserts too.
const seedAll = db.transaction(() => {
  for (const file of files) {
    const filePath = path.join(projectsDir, file);
    const html = fs.readFileSync(filePath, 'utf-8');
    const slug = slugFromFilename(file);

    // Extract metadata from the file's <meta> tags
    const title = getMeta(html, 'project-title') || slug; // Fall back to slug if no title
    const date = getMeta(html, 'project-date')  || null;
    const thumbnail = getMeta(html, 'project-thumbnail') || null;
    const summary = getMeta(html, 'project-summary') || null;
    const tagsRaw = getMeta(html, 'project-tags');

    // Parse the comma-separated tags string into a cleaned array
    const tags = tagsRaw
      ? tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
      : [];

    // 1. Upsert the project row
    upsertProject.run({title, slug, date, thumbnail, summary});

    // 2. Get the project's ID (we need it for the junction table)
    const project = getProject.get(slug);

    // 3. Clear old tag associations for this project (in case tags changed)
    deleteProjectTags.run(project.id);

    // 4. Insert each tag (if new) and create the project to tag link
    for (const tagName of tags) {
      insertTag.run(tagName);                      // Add tag to tags table if it doesn't exist
      const tag = getTag.get(tagName);             // Get its ID
      insertProjectTag.run(project.id, tag.id);   // Link project to tag
    }

    console.log(`  Seeded ${title} [${tags.join(', ') || 'no tags'}]`);
  }
});

// Run the transaction
seedAll();

console.log('\nDatabase seeded successfully.');
