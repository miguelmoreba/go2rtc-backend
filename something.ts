import { HttpTransportType, HubConnectionBuilder } from "@microsoft/signalr";
import fs from "fs";
import path from "path";

const API_URL = "https://localhost:5001";
const IMAGE_PATH = path.join(__dirname, "./images/blue.png");

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

    const imageBuffer = fs.readFileSync(IMAGE_PATH);
    console.log('I get here')
    // Convert the image data to Base64
    const base64Image = imageBuffer.toString("base64");
    console .log('I get here')

    // Send the Base64 encoded image through SignalR
    await signalRConnection.invoke("PiOffersStream", base64Image);
    console.log("Image sent to SignalR");
  } catch (error) {
    console.error("Error reading or sending image:", error);
  }

  
});

signalRConnection.on(`BrowserRequiresStream`, async () => {
  console.log("Browser requires stream");

  // Get an image from this server, send it to signalR
});
