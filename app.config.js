const fs = require('fs');
const path = require('path');

const appJson = require('./app.json');

function googleWebClientId() {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(__dirname, 'google-services.json'), 'utf8'));
    const clients = parsed.client?.[0]?.oauth_client ?? [];
    const web = clients.find((item) => item.client_type === 3);
    return typeof web?.client_id === 'string' ? web.client_id : null;
  } catch {
    return null;
  }
}

module.exports = () => ({
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo.extra ?? {}),
      googleWebClientId: googleWebClientId(),
    },
  },
});
