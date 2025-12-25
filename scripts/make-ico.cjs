const fs = require("fs");
const path = require("path");
// Version 3.0.x changed to ESM/CommonJS default export handling
const pngToIco = require("png-to-ico").default || require("png-to-ico");

async function main() {
    const pngPath = path.join(__dirname, "..", "icons", "notepad.png");
    const buildDir = path.join(__dirname, "..", "build");
    const icoPath = path.join(buildDir, "icon.ico");

    if (!fs.existsSync(buildDir)) {
        fs.mkdirSync(buildDir);
    }

    if (!fs.existsSync(pngPath)) {
        throw new Error(`Missing icon: ${pngPath}`);
    }

    const buf = await pngToIco(pngPath);
    fs.writeFileSync(icoPath, buf);
    console.log("Created icon.ico at build/icon.ico");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
