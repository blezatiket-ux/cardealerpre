exports.handler = async (event) => {
    // Check if we're in development (for security)
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            environment: process.env.NODE_ENV,
            variables: {
                DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID ? '✓ SET' : '✗ MISSING',
                DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET ? '✓ SET' : '✗ MISSING',
                DISCORD_REDIRECT_URI: process.env.DISCORD_REDIRECT_URI,
                DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
                DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN ? '✓ SET' : '✗ MISSING',
                ROLE_OWNER_ID: process.env.ROLE_OWNER_ID,
                ROLE_MANAGER_ID: process.env.ROLE_MANAGER_ID,
                ROLE_CUSTOMER_ID: process.env.ROLE_CUSTOMER_ID
            },
            note: 'For security, secret values are hidden in production'
        }, null, 2)
    };
};