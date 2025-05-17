import type { NextApiRequest, NextApiResponse } from 'next';
import config from '../../components/config';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Devolver la configuración actual
  res.status(200).json({
    config: {
      API_BASE_URL: config.API_BASE_URL,
      WHATSAPP_BOT_URL: config.WHATSAPP_BOT_URL,
      USE_MOCK_DATA: config.USE_MOCK_DATA,
    },
    serverInfo: {
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV,
    }
  });
} 