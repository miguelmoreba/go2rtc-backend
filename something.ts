import { HttpTransportType, HubConnectionBuilder } from "@microsoft/signalr";
import fs from "fs";
import path from "path";

const API_URL = "https://localhost:5001";
let color = "blue";

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
      const buffer = getImageAsBuffer();
      const base64Image = getImage(buffer);
      color = color === "blue" ? "yellow" : "blue";
      console.log(color);

      // Send the Base64 encoded image through SignalR
      await signalRConnection.invoke("PiOffersStream", base64Image);
      await signalRConnection.invoke("ImageAsBuffer", buffer);
      console.log("Image sent to SignalR");
    }, 30);
  } catch (error) {
    console.error("Error reading or sending image:", error);
  }
});

signalRConnection.on(`BrowserRequiresStream`, async () => {
  console.log("Browser requires stream");

  // Get an image from this server, send it to signalR
});

signalRConnection.on("NewImage", async (image) => {
    console.log('the image', image);
    const imageTag = `<img src="data:image/png;base64,${image}" alt="Appended Image">`;
    fs.appendFile('./test.html', imageTag, () => {
        console.log('error');
    });
})

const getImage = (imageBuffer: Buffer) => {
  // const imageBuffer = fs.readFileSync(path.join(__dirname, `./images/${color}.png`));
  return imageBuffer.toString("base64");
};

const getImageAsBuffer = () => {
  return fs.readFileSync(path.join(__dirname, `./images/${color}.png`));
}
