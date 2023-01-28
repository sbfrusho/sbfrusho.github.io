$(document).ready(function(){
    $('form').submit(function(e){
      e.preventDefault();
      var name = $('#name').val();
      var email = $('#email').val();
      var message = $('#message').val();
      if(!name){
        alert('Please enter your name');
        return;
      }
      if(!email){
        alert('Please enter your email');
        return;
      }
      if(!message){
        alert('Please enter a message');
        return;
      }
      // Send the form data to the server
      sendFormData(name, email, message);
    });
  });



  // Send the form data to the server
  function sendFormData(name, email, message) {
    // Use the Fetch API to send a POST request to the server
    fetch('your_script.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, message })
    })
      .then(response => {
        // Handle the response from the server
        if (response.ok) {
          alert('Your message has been sent!');
          form.reset();
        } else {
          alert('An error occurred. Please try again later.');
        }
      })
      .catch(error => {
        console.error('Error:', error);
      });
  }
