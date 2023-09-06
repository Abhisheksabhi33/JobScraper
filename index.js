const form = document.getElementById("job-form");
var submitButton = document.getElementById("submit-button");
const statusDiv = document.getElementById("status");
// const APIurl = "https://linkedinjobscraper.onrender.com";
// const APIurl = "http://localhost:80";
const APIurl = 'http://172.178.105.46';

form.addEventListener("submit", async (e) => {  
  e.preventDefault();

  submitButton.disabled = true;
  submitButton.style.backgroundColor = "gray"; // Change background color
  submitButton.style.cursor = "not-allowed"; // Remove pointer

  const formData = new FormData(form);
  const requestBody = {};

  formData.forEach((value, key) => {
    if (key === "companyList") {
      requestBody[key] = convertToList(value);
    } else {
      requestBody[key] = value;
    }
  });

  try {
    statusDiv.textContent = "Please wait Scraping...";
    // console.log(requestBody);

    const response = await fetch(`${APIurl}/getJobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    
    const data = await response.json();
    
    console.log(data);

    if (response.ok) {
      statusDiv.textContent = `Success! Scraped ${data.length} jobs Airtable Updated! `;
    
    } else {
      statusDiv.textContent = data.message || "Error scraping jobs";
    }
  } catch (error) {
    statusDiv.textContent = "Error: " + error.message;
  }
   
  finally {
    // Enable the submit button after scraping is completed
    submitButton.disabled = false;
    submitButton.style.backgroundColor = "bg-blue-700"; // Restore background color
    submitButton.style.cursor = "pointer"; // Restore pointer
  }


});

function convertToList(input) {
  if (input !== "") {
    const companies = input.split("\n").map((company) => company.trim());
    return companies.filter((company) => company !== "").join(",");
  }
  return "";
}
