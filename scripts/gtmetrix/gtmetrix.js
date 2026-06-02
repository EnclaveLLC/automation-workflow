const https = require("https");

const API_KEY = process.env.GTMETRIX_API_KEY;
const URL = process.argv[2];

if (!URL) {
  console.error("Usage: node gtmetrix.js <url>");
  process.exit(1);
}

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {

    const auth = Buffer.from(`${API_KEY}:`).toString("base64");

    const options = {
      hostname: "gtmetrix.com",
      path,
      method,
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/vnd.api+json"
      }
    };

    const req = https.request(options, (res) => {

      let body = "";

      res.on("data", chunk => body += chunk);

      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(body);
        }
      });

    });

    req.on("error", reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();

  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {

  console.log(`Starting GTmetrix test for ${URL}`);

  const create = await request(
    "POST",
    "/api/2.0/tests",
    {
      data: {
        type: "test",
        attributes: {
          url: URL,
          video: 0,
          retention: 1
        }
      }
    }
  );

  const testId = create.data.id;

  if (!testId) {
    console.error("Failed to create GTmetrix test");
    console.error(create);
    process.exit(1);
  }

  console.log(`Test ID: ${testId}`);

  while (true) {

    await sleep(15000);

    const result = await request(
      "GET",
      `/api/2.0/tests/${testId}`
    );

    const state = result.data.attributes.state;

    console.log(`Status: ${state}`);

    if (state === "completed") {

      console.log("GTmetrix test completed");

      const reportId = result.data.attributes?.report
        || result.data.links?.report?.split("/").pop();

      if (!reportId) {
        console.error("Could not find report ID in test response");
        process.exit(1);
      }

      const report = await request("GET", `/api/2.0/reports/${reportId}`);

      const attrs = report.data.attributes;

      console.log("");
      console.log("GTMETRIX RESULTS");
      console.log(`Grade: ${attrs.gtmetrix_grade}`);
      console.log(`Performance: ${attrs.performance_score}`);
      console.log(`Structure: ${attrs.structure_score}`);

      const today = new Date().toISOString().slice(0, 10);

      console.log("RESULT_JSON:" + JSON.stringify({
        url: URL,
        date: today,
        grade: attrs.gtmetrix_grade,
        performance: attrs.performance_score,
        structure: attrs.structure_score
      }));

      if (attrs.performance_score < 90) {
        process.exit(1);
      }

      break;
    }
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});