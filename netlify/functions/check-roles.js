const fetch = require('node-fetch');

exports.handler = async (event) => {
    console.log('🔧 ROLE CHECKER TOOL 🔧');
    
    try {
        const YOUR_GUILD_ID = process.env.DISCORD_GUILD_ID;
        const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
        
        console.log('Guild ID:', YOUR_GUILD_ID);
        console.log('Bot Token:', BOT_TOKEN ? 'Present' : 'MISSING');
        
        // Get ALL roles from the guild
        const rolesResponse = await fetch(
            `https://discord.com/api/guilds/${YOUR_GUILD_ID}/roles`, {
            headers: { Authorization: `Bot ${BOT_TOKEN}` }
        });
        
        if (!rolesResponse.ok) {
            const error = await rolesResponse.text();
            return {
                statusCode: 500,
                body: JSON.stringify({
                    error: 'Failed to fetch roles',
                    details: error,
                    status: rolesResponse.status
                })
            };
        }
        
        const allRoles = await rolesResponse.json();
        
        // Format for display
        const roleList = allRoles.map(role => ({
            id: role.id,
            name: role.name,
            color: role.color.toString(16).padStart(6, '0'),
            position: role.position,
            permissions: role.permissions
        })).sort((a, b) => b.position - a.position);
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Found ${roleList.length} roles in guild`,
                guildId: YOUR_GUILD_ID,
                roles: roleList,
                environment: {
                    ROLE_OWNER_ID: process.env.ROLE_OWNER_ID,
                    ROLE_MANAGER_ID: process.env.ROLE_MANAGER_ID,
                    ROLE_CUSTOMER_ID: process.env.ROLE_CUSTOMER_ID
                }
            }, null, 2)
        };
        
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: error.message,
                stack: error.stack
            })
        };
    }
};