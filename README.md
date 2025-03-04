# lrpreset (Pic2Preset)

A web application that uses AI to automatically generate Adobe Lightroom presets from any photo. Upload your favorite photos and get custom Lightroom presets that match their style and aesthetic.

## Features

- AI-powered preset generation from images
- Support for JPG, PNG, and WebP image formats
- XMP preset file generation compatible with Adobe Lightroom
- Secure Google authentication
- Integrated payment system for preset purchases
- User dashboard to manage presets
- Preview system to test presets before purchase

## Tech Stack

- **Frontend**: HTML, JavaScript, CSS
- **Backend**: Flask (Python)
- **Storage**: Supabase
- **Authentication**: Google OAuth
- **Payments**: Stripe
- **AI/ML**: Custom LLM integration for preset generation

## Setup

1. Clone the repository
2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up environment variables in `.env`:
   - Google OAuth credentials
   - Stripe API keys
   - Supabase credentials
   - Other configuration values

5. Start the application:
   ```bash
   python run.py
   ```

6. Open the application in a web browser at http://localhost:8000

## Usage

1. Sign in using your Google account
2. Upload a photo you want to create a preset from
3. Wait for the AI to analyze your image and generate a preset
4. Preview the preset effects
5. Purchase and download the XMP file
6. Import the XMP file into Adobe Lightroom

## Development

- Backend runs on port 8000
- Frontend is static HTML/JS/CSS
- Development mode bypasses payment requirements
- Supports file uploads up to 164MB

## License

See [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
