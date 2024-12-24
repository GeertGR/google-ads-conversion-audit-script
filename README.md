# Google Ads Conversion Audit Script

## Overview
This Google Ads script performs a comprehensive audit of conversion tracking across your account and generates a detailed HTML report. The script analyzes:

- Conversion Actions
- Conversion Settings
- Conversion Performance
- Device Performance
- Trend Analysis
- Conversion Quality Metrics

## Features
- Detailed analysis of conversion tracking implementation
- Performance metrics and trends
- Comprehensive HTML report with:
  - Overview of all conversion actions
  - Performance statistics for custom time periods
  - Device-specific conversion data
  - Status indicators and improvement suggestions
  - Trend analysis and insights
- Email notification system
- Error handling and logging

## Requirements
- Google Ads account with Editor access
- Gmail account for email notifications

## Installation
1. Go to your Google Ads account
2. Navigate to Tools & Settings > Bulk Actions > Scripts
3. Click the + button to create a new script
4. Copy the contents of `conversion_audit.js` into the editor
5. Update the `CONFIG` object with your email address and desired audit period:

```javascript
var CONFIG = {
    EMAIL: {
        ENABLED: true,
        RECIPIENT: "YOUR_EMAIL_HERE",
        SUBJECT_PREFIX: "Conversion Audit Report"
    },
    AUDIT_PERIOD_DAYS: 30  // Adjust as needed (30, 60, 90 days)
};
```

## Usage
The script can be:
- Run manually from the Google Ads Scripts interface
- Scheduled to run automatically (recommended: weekly or monthly)

## Report Features
The generated HTML report includes:
- Conversion action overview with status indicators
- Performance metrics for the selected time period
- Device-specific conversion analysis
- Trend analysis and performance insights
- Recommendations for optimization
- Visual indicators for potential issues

## Author
Geert Groot

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support
For questions or custom implementations, feel free to connect on [LinkedIn](https://www.linkedin.com/in/geertgroot/) 