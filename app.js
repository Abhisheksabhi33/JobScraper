// app.js
import express from "express";
import { getJobs } from "./middleware/getJobs.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
import path from "path";

const port = process.env.PORT || 80;

// Serve static 
app.use(express.static(path.join(path.resolve(), ".")));

// Route for the home page
app.get("/", (req, res) => {
  res.send("Welcome to LinkedIn Job Scraper!");
});

// Route for a sample API endpoint
app.post("/getJobs", getJobs);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
