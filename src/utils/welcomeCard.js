const { createCanvas, loadImage } = require('canvas');
const path = require('path');

/**
 * Creates a welcome card image using canvas.
 * @param {GuildMember} member The member who joined.
 * @param {string} backgroundPath Path to the background image.
 * @returns {Promise<Buffer>} The generated image buffer.
 */
async function createWelcomeCard(member, backgroundPath) {
  const canvas = createCanvas(800, 400);
  const ctx = canvas.getContext('2d');

  // Load background
  try {
    const background = await loadImage(backgroundPath);
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
  } catch (err) {
    // If background fails to load, draw a solid color
    ctx.fillStyle = '#2c2f33';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Draw a semi-transparent overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);

  // Avatar drawing
  const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
  const avatar = await loadImage(avatarUrl);

  ctx.save();
  ctx.beginPath();
  ctx.arc(canvas.width / 2, 100, 75, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(avatar, canvas.width / 2 - 75, 25, 150, 150);
  ctx.restore();

  // Username
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(member.user.username, canvas.width / 2, 230);

  // Welcome message
  ctx.font = '30px sans-serif';
  ctx.fillText(`Welcome to ${member.guild.name}!`, canvas.width / 2, 280);

  // Member count
  ctx.font = '24px sans-serif';
  ctx.fillText(`Member #${member.guild.memberCount}`, canvas.width / 2, 330);

  return canvas.toBuffer();
}

module.exports = { createWelcomeCard };
