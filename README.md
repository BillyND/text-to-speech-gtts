# text-to-speech-gtts

## Description

This project is a text-to-speech (TTS) application built using Node.js and Express.js. It converts text into speech and serves the audio files through a web interface.

## Features

- **Text-to-Speech Conversion**: Utilizes the `gtts` library to convert text to speech.
- **Language Support**: Supports multiple languages, with Vietnamese as the default.
- **Speed Adjustment**: Allows adjusting the speed of the speech using FFmpeg.
- **Static File Serving**: Serves static files from the `public` directory.
- **Audio File Management**: Stores audio files in the `audio` directory and cleans up old files.

## Installation

1. Clone the repository.
2. Install dependencies using `npm install`.

## Usage

- **Start the Server**: Run `npm start` to start the server.
- **Development Mode**: Run `npm run dev` to start the server with Nodemon for automatic restarts.
- **Text-to-Speech Script**: Run `npm run tts` to execute the TTS script.

### Endpoints

- `POST /tts`: Accepts text, speed, and language parameters to generate speech.
- `GET /`: Serves the home page with language options.

## Dependencies

- `express`: Web framework for Node.js.
- `gtts`: Google Text-to-Speech library.
- `dotenv`: Loads environment variables from a `.env` file.
- `child_process`, `fs`: Node.js modules for file and process management.
- `nodemon`: Development tool for auto-restarting the server.
