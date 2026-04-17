
$(document).ready(function () {
	
  // click handler for dynamically added paragraphs/tags boxes
    $('#tag_selection').on('click', 'p', function () {
      $(this).toggleClass('chosen');
    });
	
	
	//Load tags from server
	$.getJSON('/api/tags', function (tags) {
		tags.forEach(function (tag) {
		  const paragraph = $('<p></p>').text(tag);
		  $('#tag_selection').append(paragraph);
		});

	});
  });
