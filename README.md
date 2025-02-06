# FB Price Scraper

A robust web scraper designed to collect and monitor player prices from FUTBIN, a popular FIFA Ultimate Team database website. This tool efficiently gathers price data for specified players across different platforms (PC and Console) and sends the collected information to a designated API endpoint.

## Features

- 🎮 Multi-platform price tracking (PC and Console)
- 📊 Collects up to 5 different price points per platform
- ⏰ Price update timestamp tracking
- 🛡️ Advanced anti-bot detection bypass
- 🔄 Automatic rate limiting
- 📝 Detailed logging system

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn package manager

## Installation

### Standard Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/fb-price-scraper.git
cd fb-price-scraper
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Fill in the required environment variables:
     - `FUTBIN_BASE_URL`: Base URL for FUTBIN
     - `CF_SCRAPER_ENDPOINT`: Cloudflare scraper endpoint
     - `JA3_FINGERPRINT`: Browser fingerprint for anti-bot bypass
     - `API_ENDPOINT`: Endpoint where price data will be sent
     - `RATE_LIMIT_MS`: Rate limiting in milliseconds

### Docker Installation

1. Build the Docker image:
```bash
docker build -t fb-price-scraper .
```

2. Run the container:
```bash
docker run -d \
  --name fb-price-scraper \
  -v $(pwd)/.env:/app/.env \
  -v $(pwd)/players.json:/app/players.json \
  fb-price-scraper
```

You can view the logs using:
```bash
docker logs -f fb-price-scraper
```

To stop the container:
```bash
docker stop fb-price-scraper
```

To remove the container:
```bash
docker rm fb-price-scraper
```

## Usage

1. Prepare your player list in `players.json` file with player endpoints.

2. Run the scraper:
```bash
node index.js
```

## Project Structure

- `index.js` - Main scraper logic
- `players.json` - List of player endpoints to scrape
- `.env` - Environment configuration
- `Dockerfile` - Container configuration for Docker deployment

## Dependencies

- `axios`: HTTP client for API requests
- `cheerio`: HTML parsing and manipulation
- `cycletls`: TLS fingerprint manipulation
- `dotenv`: Environment variable management

## Error Handling

The scraper includes comprehensive error handling for:
- Network failures
- Invalid responses
- Rate limiting
- API communication errors

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License.

## Disclaimer

This tool is for educational purposes only. Please ensure you comply with FUTBIN's terms of service and implement appropriate rate limiting. 