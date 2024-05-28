import { HttpTransportType, HubConnectionBuilder } from "@microsoft/signalr";
import axios from "axios";
import fs from "fs";
import path from "path";

const API_URL = "https://localhost:5001";
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
      const buffer = getImageAsBuffer(color);
      const base64Image = getImage(buffer);
      color++;
      console.log(color);

      const response = await axios.get(
        "https://localhost/capture?shrink=0.5",
        { responseType: "arraybuffer" }
      );
      const bufferFromResponse = Buffer.from(response.data, "binary");
      const base64ImageFromResponse = bufferFromResponse.toString("base64");

      console.log("RESPONSE", response, base64ImageFromResponse);

      // Send the Base64 encoded image through SignalR
      await signalRConnection.invoke("PiOffersStream", base64ImageFromResponse);
      // await signalRConnection.invoke("ImageAsBuffer", buffer);
      console.log("Image sent to SignalR");
    }, 1000);
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
