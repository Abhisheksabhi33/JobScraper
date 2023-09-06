import env from "dotenv";
env.config();
import fetch from "node-fetch";

const apiUrl = `https://api.apify.com/v2/acts/bebity~linkedin-jobs-scraper/run-sync-get-dataset-items?token=${process.env.API_TOKEN}`;

import Airtable from "airtable";

let jobLength = 0;

function extractCompanyNameFromUrl1(url) {
  // Use a regular expression to extract the company name
  const match = url.match(/\/company\/([^/?]+)/);

  // Check if a match was found
  if (match && match[1]) {
    return match[1];
  } else {
    return null; // Return null if no match was found
  }
}

function extractCompanyNameFromUrl2(url) {
  const regex = /\/company\/([^/]+)\/?$/;
  const match = url.match(regex);

  if (match && match[1]) {
    return match[1];
  } else {
    return null;
  }
}

var base = new Airtable({
  apiKey: process.env.ACCESS_KEY,
}).base("appk3PmNGPCJdwPD0");


var table = base("JobsByClient");
var table2 = base("companyDetails");

export const getJobs = async (req, res) => {
  // console.log(req.body);

  // data need from the client
  const {
    job_keywords,
    companyList,
    job_location,
    job_posted_date,
    job_mode,
    totalJobs,
    experience_level,
  } = req.body;

  // console.log(
  //   job_keywords + " " + typeof job_keywords,
  //   companyList + " " + typeof companyList,
  //   job_location + " " + typeof job_location,
  //   job_posted_date + " " + typeof job_posted_date,
  //   job_mode + " " + typeof job_mode,
  //   totalJobs + " " + typeof totalJobs
  //   experience_level + " " + typeof experience_level
  // );

  let titleArray = job_keywords.split(",");
  titleArray = titleArray.map((title) => title.trim());

  let company_list = companyList.split(",");
  company_list = company_list.map((company) => company.trim());

  // console.log("companyList: " + company_list + " " + typeof company_list);

  // make all a new promise
  const fetchDataForTitle = async (title, jobMode) => {
    return new Promise(async (resolve, reject) => {
      let requestData = {
        title,
        location: job_location,
      };

      if (
        company_list.length > 0 &&
        company_list[0] !== "" &&
        company_list[0] !== " "
      ) {
        requestData.companyName = company_list;
      }

      if (job_posted_date !== "") {
        requestData.publishedAt = job_posted_date;
      }

      // console.log(job_mode);
      // console.log(typeof job_mode);

      if (jobMode !== "") {
        requestData.workType = jobMode;
      }

      if (experience_level !== "") {
        requestData.experienceLevel = experience_level;
      }

      if (totalJobs !== "") {
        requestData.rows = parseInt(totalJobs);
      }

      console.log(requestData);

      const requestOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      };

      try {
        const response = await fetch(apiUrl, requestOptions);
        const data = await response.json();

        // Filter out internship jobs
        const filteredData = data.filter(
          (job) => job.experienceLevel.toLowerCase() !== "internship"
        );

        resolve(filteredData);
      } catch (error) {
        reject(error);
      }
    });
  };

  const fetchAllData = async () => {
    try {
      console.log(job_mode);
      console.log(typeof job_mode);

      if (job_mode === "4") {
        // make all a new promise for each title as well as for each job_mode
        let promises = titleArray.map((title) => fetchDataForTitle(title, "2"));
        promises = promises.concat(
          titleArray.map((title) => fetchDataForTitle(title, "3"))
        );
        const dataArray = await Promise.all(promises);
        return dataArray;
      } else {
        const promises = titleArray.map((title) =>
          fetchDataForTitle(title, job_mode)
        );
        const dataArray = await Promise.all(promises);
        return dataArray;
      }
    } catch (error) {
      throw error;
    }
  };

  var noOfJobs = 0;

  const getAllData = async () => {
    return new Promise(async (resolve, reject) => {
      try {
        const responseDataArray = await fetchAllData();

        // Merge all the response data into a single array
        let allJobs = [];
        responseDataArray.forEach((data) => {
          allJobs = allJobs.concat(data);
        });

        // console.log(allJobs);

        // Filter out internship jobs directly before adding to uniqueJobSet
        allJobs = allJobs.filter(
          (job) => job.contractType.toLowerCase() !== "internship"
        );

        noOfJobs = allJobs.length;
        jobLength = noOfJobs;

        if (noOfJobs > 0) {
          console.log(`Total number of jobs Found: ${noOfJobs}`);
          // console.log(allJobs);

          const uniqueJobSet = new Set();
          const job_title = new Set();

          for (let i = 0; i < noOfJobs; i++) {
            const job = allJobs[i];

            if (job !== null && job !== undefined && job !== "") {
              uniqueJobSet.add(job);
            }
          }

          // updating table with all jobs

          console.log(
            "total unique jobs: " + uniqueJobSet.size + " before table update"
          );

          // add job Mode in the uniqueJobSet object
          for (let job of uniqueJobSet) {
            job.jobMode = job_mode;
          }

          await updateTable(uniqueJobSet, res);

          await inCludeMoreData(uniqueJobSet, res);

          jobLength = uniqueJobSet.size;

          resolve("All jobs added to Airtable");
        } else {
          res.json({
            message: "No jobs found",
            length: 0,
          });
        }
      } catch (error) {
        res.json({
          message: "Error: " + error,
        });
      }
    });
  };

  await getAllData();

  if (
    jobLength !== 0 ||
    jobLength !== null ||
    jobLength !== undefined ||
    jobLength !== ""
  ) {
    res.json({
      message: "All jobs added to Airtable!!!",
      length: jobLength,
    });
  } else {
    res.json({
      message: "No jobs found",
      length: 0,
    });
  }

  console.log("All jobs added to Airtable!!!");
};

async function updateTable(uniqueJobSet, res) {
  let UniqueCompanies = new Set();

  console.log("we have " + uniqueJobSet.size + " jobs to add to Airtable ");

  for (let job of uniqueJobSet) {
    if (job.contractType.toLowerCase() === "internship") {
      continue; // Skip internship jobs
    }

    const jobTitle = job.title;
    const jobUrl = job.jobUrl;
    const publishedAt = job.publishedAt;
    const salary = job.salary;
    const linkedinUrl = job.companyUrl;
    const location = job.location;
    const jobPostedTime = job.postedTime;
    const applicationsCount = job.applicationsCount;
    const JobDescription = job.description;
    const contractType = job.contractType;
    const experienceLevel = job.experienceLevel;
    const work_type = job.workType;
    const sector = job.sector;
    const companyId = job.companyId;
    let companyName = job.companyName;
    let jobMode = job.jobMode;

    if (jobMode === "1") {
      jobMode = "On-Site";
    } else if (jobMode === "2") {
      jobMode = "Remote";
    } else if (jobMode === "3") {
      jobMode = "Hybrid";
    } else if (jobMode === "4") {
      jobMode = "Remote, Hybrid";
    }

    // create row on airtable

    if (
      !(companyName === undefined || companyName === null || companyName === "")
    ) {
      UniqueCompanies.add(companyName);
    }

    if (experienceLevel.toLowerCase !== "internship") {
      try {
        // const records = await table
        //   .select({
        //     view: "Grid view",
        //   })
        //   .all();

        await new Promise((resolve, reject) => {
          // for (let record of records) {
          //   let jurl1 = record.get("Job Url");
          //   if (jurl1 === jobUrl) {
          //     console.log("Job already exists");
          //     resolve();
          //     return;
          //   }
          // }

          table.create(
            [
              {
                fields: {
                  "Job Title": jobTitle,
                  "Job Url": jobUrl,
                  "Published At": publishedAt,
                  Salary: salary,
                  "Linkedin Url": linkedinUrl,
                  "Job Location": location,
                  "Job Posted Time": jobPostedTime,
                  "Applications Count": applicationsCount,
                  "Job Description": JobDescription,
                  "Employment Type": contractType,
                  "Experience Level": experienceLevel,
                  "Work Type": work_type,
                  Industry: sector,
                  "Company Id": companyId,
                  "Company Name": companyName,
                  "Job Mode": jobMode ? jobMode : "On-Site",
                },
              },
            ],
            function (err, records) {
              if (err) {
                console.error(err);
                return;
              }

              resolve(records);
            }
          );
        });
      } catch (error) {
        console.log("Error: " + error);
      }
    }
  }

  let uniqueCompaniesArray = Array.from(UniqueCompanies);
}

async function getMore(apiUrl) {
  try {
    return new Promise(async (resolve, reject) => {
      console.log(apiUrl);
      const records = await table2
        .select({
          view: "Grid view",
        })
        .all();
      for (let record of records) {
        // if (record.get("Linkedin Url") === apiUrl) {
        //   resolve();
        // }

        let comName1 = extractCompanyNameFromUrl1(apiUrl);

        let url2 = record.get("Linkedin Url");

        let comName2 = extractCompanyNameFromUrl1(url2);

        comName1 = comName1.toLowerCase();
        comName2 = comName2.toLowerCase();

        if (comName1 === comName2) {
          console.log("Company already exists");
          resolve();
          return;
        }
      }
      const url = `https://api.apify.com/v2/acts/bebity~linkedin-premium-actor/run-sync-get-dataset-items?token=${process.env.API_TOKEN}`;

      const requestData = {
        action: "get-companies",
        isName: false,
        isUrl: true,
        keywords: [apiUrl], // Use apiUrl parameter here
        limit: 1,
      };

      const requestOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      };

      const response = await fetch(url, requestOptions);

      if (response.ok) {
        const data = await response.json();
        if (data.length == 0) {
          resolve();
        }
        console.log(data);
        const companyName = data[0]?.name ? data[0]?.name : "";
        const linkedinUrl = data[0]?.url ? data[0]?.url : "";
        const companyDescription = data[0]?.description
          ? data[0]?.description
          : "";
        let industry = data[0]?.industry ? data[0]?.industry : "";
        const companyUrl = data[0]?.websiteUrl ? data[0]?.websiteUrl : "";
        // let headquarter = data[0]?.headquarter?.city + " " + data[0]?.headquarter?.country;
        // const headquarter = data[0]?.headquarter
        //   ? data[0]?.headquarter?.city
        //   : "" + " " + data[0]?.headquarter
        //   ? data[0]?.headquarter?.country
        //   : "";
        let city = data[0]?.headquarter?.city ? data[0]?.headquarter?.city : "";
        let country = data[0]?.headquarter?.country ? data[0]?.headquarter?.country : "";
        let headquarter = city + " " + country;
        
        const companySize = data[0]?.employeeCount
          ? data[0]?.employeeCount
          : "";
        const followerCount = data[0]?.followerCount
          ? data[0]?.followerCount
          : "";

        // Change industry array into a string
        if (industry !== "" && industry.length > 0) {
          industry = industry.join("");
        }

        const obj = {
          name: companyName,
          url: linkedinUrl,
          description: companyDescription,
          industry: industry,
          websiteUrl: companyUrl,
          headquarter: headquarter,
          employeeCount: companySize,
          followerCount: followerCount,
        };

        if (obj.name !== "" && obj.url !== "") {
          table2.create(
            [
              {
                fields: {
                  "Company Name": obj?.name,
                  "Linkedin Url": obj?.url,
                  "Company Description": obj?.description,
                  Industry: obj?.industry,
                  Domain: obj?.websiteUrl,
                  Headquarter: obj?.headquarter,
                  "Company Size": obj?.employeeCount?.toString(),
                  "Follower Count": obj?.followerCount?.toString(),
                },
              },
            ],
            function (err, records) {
              if (err) {
                console.error(err);
                return;
              }
            }
          );
        }
        resolve(obj);
      }

      resolve();
    });
  } catch (error) {
    console.log("Error: " + error);
    throw error; // Throw the error instead of rejecting the promise
  }
}

async function inCludeMoreData(uniqueJobSet, res) {
  const linkedinUrls = new Set();

  uniqueJobSet.forEach((element) => {
    linkedinUrls.add(element.companyUrl);
  });

  const linkedUrl = Array.from(linkedinUrls);

  console.log(linkedUrl);
  console.log(linkedUrl.length);

  try {
    // const promises = linkedUrl.map((url) => getMore(url));
    const promises = [];
    for (let url of linkedUrl) {
      promises.push(await getMore(url));
    }
  } catch (error) {
    console.error("Error in one or more getMore calls: " + error);
  }
}
