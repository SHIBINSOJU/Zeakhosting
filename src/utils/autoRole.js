/**
 * Assigns an auto-role to a new member.
 * @param {GuildMember} member The member who joined.
 * @param {string} roleId The ID of the role to assign.
 */
async function assignAutoRole(member, roleId) {
  if (!roleId) return;

  try {
    const role = member.guild.roles.cache.get(roleId);
    if (role) {
      await member.roles.add(role);
    }
  } catch (err) {
    // Silently fail as per requirements
    // This could be due to missing permissions or role being above the bot's highest role
  }
}

module.exports = { assignAutoRole };
