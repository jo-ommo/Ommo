#!/usr/bin/env node

/**
 * JWT Token Generator for Voice Agent Testing
 * 
 * Usage:
 *   node generate-jwt.js
 *   node generate-jwt.js --company-id=custom-company --user-id=custom-user
 *   JWT_SECRET=your-secret node generate-jwt.js
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
};

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-here';
const COMPANY_ID = getArg('company-id') || process.env.TEST_COMPANY_ID || `test-company-${crypto.randomUUID()}`;
const USER_ID = getArg('user-id') || process.env.TEST_USER_ID || `test-user-${crypto.randomUUID()}`;
const ROLE = getArg('role') || 'admin';
const EXPIRES_IN = getArg('expires') || '1h';

// Create JWT payload
const payload = {
  companyId: COMPANY_ID,
  userId: USER_ID,
  role: ROLE,
  permissions: [
    'voice_agent:create',
    'voice_agent:read', 
    'voice_agent:update',
    'voice_agent:delete',
    'agent:deploy',
    'agent:stop',
    'metrics:read'
  ],
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + getExpirationSeconds(EXPIRES_IN)
};

function getExpirationSeconds(expiresIn) {
  const units = {
    's': 1,
    'm': 60,
    'h': 3600,
    'd': 86400
  };
  
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) return 3600; // Default 1 hour
  
  const [, number, unit] = match;
  return parseInt(number) * (units[unit] || 3600);
}

try {
  // Generate the token
  const token = jwt.sign(payload, JWT_SECRET);
  
  console.log('🔐 JWT Token Generated Successfully');
  console.log('=====================================');
  console.log(`Company ID: ${COMPANY_ID}`);
  console.log(`User ID: ${USER_ID}`);
  console.log(`Role: ${ROLE}`);
  console.log(`Expires: ${EXPIRES_IN}`);
  console.log('');
  console.log('🎫 JWT Token:');
  console.log(token);
  console.log('');
  console.log('📋 Usage Examples:');
  console.log('');
  console.log('# Export as environment variable:');
  console.log(`export JWT_TOKEN="${token}"`);
  console.log('');
  console.log('# Use in curl commands:');
  console.log(`curl -H "Authorization: Bearer ${token}" \\`);
  console.log('  http://localhost:3000/api/v1/voice-agents');
  console.log('');
  console.log('# Use in test scripts:');
  console.log(`JWT_SECRET="${JWT_SECRET}" ./run-tests.sh`);
  
  // Verify the token
  console.log('');
  console.log('🔍 Token Verification:');
  const decoded = jwt.verify(token, JWT_SECRET);
  console.log('Token is valid ✅');
  console.log('Decoded payload:', JSON.stringify(decoded, null, 2));
  
} catch (error) {
  console.error('❌ Error generating JWT token:', error.message);
  console.error('');
  console.error('💡 Make sure you have the jsonwebtoken package installed:');
  console.error('   npm install jsonwebtoken');
  process.exit(1);
} 