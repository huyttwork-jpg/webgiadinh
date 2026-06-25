require('dotenv').config();

/**
 * Send SMS OTP using configured providers (Twilio or SpeedSMS)
 * Falls back to console logging if no API keys are set.
 * 
 * @param {string} to - Recipient phone number
 * @param {string} body - SMS message content
 * @returns {Promise<{success: boolean, provider: string}>}
 */
async function sendSMS(to, body) {
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_FROM_NUMBER;
  const speedSmsKey = process.env.SPEEDSMS_API_KEY;

  if (twilioSid && twilioToken && twilioFrom) {
    try {
      console.log(`[SMS] Đang gửi tin nhắn qua Twilio tới ${to}...`);
      await _sendTwilio(to, body, twilioSid, twilioToken, twilioFrom);
      console.log('[SMS] Gửi tin nhắn qua Twilio thành công.');
      return { success: true, provider: 'twilio' };
    } catch (error) {
      console.error('[SMS] Lỗi gửi SMS qua Twilio:', error.message);
      throw error;
    }
  } else if (speedSmsKey) {
    try {
      console.log(`[SMS] Đang gửi tin nhắn qua SpeedSMS tới ${to}...`);
      await _sendSpeedSMS(to, body, speedSmsKey);
      console.log('[SMS] Gửi tin nhắn qua SpeedSMS thành công.');
      return { success: true, provider: 'speedsms' };
    } catch (error) {
      console.error('[SMS] Lỗi gửi SMS qua SpeedSMS:', error.message);
      throw error;
    }
  } else {
    // Fallback mode for local development
    console.log('\n==========================================');
    console.log('[MÔ PHỎNG SMS] Chưa cấu hình API SMS (.env)');
    console.log(`Gửi tới SĐT: ${to}`);
    console.log(`Nội dung: ${body}`);
    console.log('==========================================\n');
    return { success: true, provider: 'console_log' };
  }
}

/**
 * Send SMS via Twilio API
 */
async function _sendTwilio(to, body, sid, token, from) {
  let formattedTo = to.trim();
  if (formattedTo.startsWith('0')) {
    formattedTo = '+84' + formattedTo.slice(1);
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  
  const params = new URLSearchParams();
  params.append('To', formattedTo);
  params.append('From', from);
  params.append('Body', body);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Lỗi HTTP từ Twilio.');
  }
  return data;
}

/**
 * Send SMS via SpeedSMS API
 */
async function _sendSpeedSMS(to, body, key) {
  let cleanPhone = to.trim();
  if (cleanPhone.startsWith('+84')) {
    cleanPhone = '0' + cleanPhone.slice(3);
  }

  const url = 'https://api.speedsms.vn/index.php/sms/send';
  const auth = Buffer.from(`${key}:x`).toString('base64');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: [cleanPhone],
      content: body,
      sms_type: 2,
      sender: ''
    })
  });

  const data = await response.json();
  if (!response.ok || data.status !== 'success') {
    throw new Error(data.message || 'Lỗi API từ SpeedSMS.');
  }
  return data;
}

module.exports = {
  sendSMS
};
