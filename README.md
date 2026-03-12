# XRD Analyzer - Rietveld Refinement Viewer

A powerful web application for analyzing X-ray diffraction (XRD) data, visualizing Rietveld refinement results, and identifying phases using Google's Gemini AI.

## Features

- **Local File Processing**: Parse `.cif` and `.xy` files directly in the browser. Your experimental data is never sent to a server, ensuring complete privacy and fast processing.
- **Interactive Plotting**: Zoom, pan, and customize the display of experimental ($Y_{obs}$) and calculated ($Y_{cal}$) curves, along with the difference curve.
- **Advanced Customization**: Adjust step sizes, line styles, dot sizes, legend positions, and difference curve offsets.
- **Phase Identification**: Use Gemini AI to verify expected materials and automatically plot their standard Bragg peak positions directly on your spectrum.
- **High-Resolution Export**: Download publication-ready, high-resolution PNG plots.

## Prerequisites

To run this application locally on your PC, you will need:
- [Node.js](https://nodejs.org/) (v18 or higher is recommended)
- npm (comes pre-installed with Node.js)

## Getting Started

### 1. Install Dependencies
Open your terminal, navigate to the root folder of this project, and run the following command to install all required packages:
\`\`\`bash
npm install
\`\`\`

### 2. Set Up Environment Variables
This application uses Google's Gemini AI for the "Phase Identification" feature. You need an API key to enable this functionality.
1. Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Create a new file named `.env` in the root directory of the project (next to `package.json`).
3. Add your API key to the `.env` file like this:
   \`\`\`env
   GEMINI_API_KEY=your_actual_api_key_here
   \`\`\`

### 3. Run the Development Server
Start the local development server by running:
\`\`\`bash
npm run dev
\`\`\`
The terminal will output a local URL (typically `http://localhost:5173` or `http://localhost:3000`). Open this URL in your web browser to use the application.

### 4. Build for Production (Optional)
If you want to create a production-ready, optimized build of the application, run:
\`\`\`bash
npm run build
\`\`\`
The compiled, minified assets will be available in the `dist` folder, which you can then host on any static file server (like GitHub Pages, Vercel, or Netlify).

## Usage Guide

1. **Upload Data**: Drag and drop your `.cif` or `.xy` Rietveld refinement files into the upload area.
2. **Adjust View**: Use the "Min 2θ" and "Max 2θ" inputs to focus on a specific range, or simply click and drag on the chart to zoom in.
3. **Customize Plot**: Click the "Settings" button to change line thicknesses, styles, and the legend position.
4. **Identify Phases**: Scroll down to the Gemini AI section, type in the materials you suspect are in your sample (e.g., "Quartz, Calcite"), and click "Verify Phases".
5. **Approve Phases**: Review Gemini's analysis and click "Add to Plot" to overlay the standard Bragg peaks for that material onto your chart.
6. **Export**: Click "Download PNG" to save a high-resolution image of your customized plot.
