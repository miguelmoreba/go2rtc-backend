import { HttpTransportType, HubConnectionBuilder } from "@microsoft/signalr";
import axios from "axios";
import fs from "fs";
import path from "path";

// const API_URL = "https://localhost:5001";
const API_URL = "https://dev-api-vpc.egoscue.com";

let color = 1;

const signalRConnection = new HubConnectionBuilder()
  .withUrl(`${API_URL}/hubs/v1/depthCameraHub`, {
    withCredentials: false,
    transport: HttpTransportType.WebSockets,
    skipNegotiation: true,
  })
  .build();

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

signalRConnection.start().then(async () => {
  try {
    console.log("Connected to signalR");
    // Read the image file from the file system
    setInterval(async () => {

      const base64Image = await getImageFromFile();
      // const base64Image = await getImageFromCamera();


      // Send the Base64 encoded image through SignalR
      console.log(base64Image);
      await signalRConnection.invoke("Image", base64Image);
      // await signalRConnection.invoke("ImageAsBuffer", buffer);
      console.log("Image sent to SignalR");
    }, 60);
  } catch (error) {
    console.error("Error reading or sending image:", error);
  }
});

signalRConnection.on(`BrowserRequiresStream`, async () => {
  console.log("Browser requires stream");

  // Get an image from this server, send it to signalR
});

// signalRConnection.on("NewImage", async (image) => {
//     console.log('the image', image);
//     const imageTag = `<img src="data:image/png;base64,${image}" alt="Appended Image">`;
//     fs.appendFile('./test.html', imageTag, () => {});
// })

const getImage = (imageBuffer: Buffer) => {
  // const imageBuffer = fs.readFileSync(path.join(__dirname, `./images/${color}.png`));
  return imageBuffer.toString("base64");
};

const getImageAsBuffer = (imageName: number) => {
  return fs.readFileSync(path.join(__dirname, `./video/${imageName}.jpeg`));
};

const getImageFromCamera = async () => {
  const response = await axios.get("https://localhost/capture?shrink=0.5", {
    responseType: "arraybuffer",
  });
  const bufferFromResponse = Buffer.from(response.data, "binary");
  return bufferFromResponse.toString("base64");
};

const getImageFromFile = async () => {
  const buffer = getImageAsBuffer(color);
  color++;
  console.log(color);
  return getImage(buffer);
};
