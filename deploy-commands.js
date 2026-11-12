// ============================================================================
// deploy-commands.js - Register Discord Slash Commands
// ============================================================================

require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('rathole')
    .setDescription('Comandos de gestão e consulta de Ratholes')
    .addSubcommand((sub) =>
      sub
        .setName('info')
        .setDescription('Exibe dono, co-owner, coordenadas e TP do rathole')
        .addIntegerOption((opt) =>
          opt.setName('numero').setDescription('Número do Rathole').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('proximo')
        .setDescription('Busca os ratholes mais próximos das coordenadas dadas')
        .addNumberOption((opt) =>
          opt.setName('x').setDescription('Coordenada X (0 a 100)').setRequired(true)
        )
        .addNumberOption((opt) =>
          opt.setName('y').setDescription('Coordenada Y (0 a 100)').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('dono')
        .setDescription('Filtra ratholes onde o jogador é Dono (Owner Principal)')
        .addStringOption((opt) =>
          opt.setName('jogador').setDescription('Nome do jogador').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('owner')
        .setDescription('Filter ratholes where player is primary Owner')
        .addStringOption((opt) =>
          opt.setName('player').setDescription('Player name').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('responsavel')
        .setDescription('Filtra ratholes onde o jogador é Responsável (Owner ou Co-Owner)')
        .addStringOption((opt) =>
          opt.setName('jogador').setDescription('Nome do jogador').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('responsible')
        .setDescription('Filter ratholes where player is Responsible (Owner or Co-Owner)')
        .addStringOption((opt) =>
          opt.setName('player').setDescription('Player name').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('near')
        .setDescription('Find ratholes nearest to given coordinates (x, y)')
        .addNumberOption((opt) =>
          opt.setName('x').setDescription('Coordinate X').setRequired(true)
        )
        .addNumberOption((opt) =>
          opt.setName('y').setDescription('Coordinate Y').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('vincular')
        .setDescription('Liga sua conta Discord ao nome de owner usado nos ratholes')
        .addStringOption((opt) =>
          opt.setName('nome').setDescription('Nome de owner, como Oli').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('link')
        .setDescription('Link your Discord account to the owner name used on ratholes')
        .addStringOption((opt) =>
          opt.setName('name').setDescription('Owner name, such as Oli').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('listar').setDescription('Lista todos os ratholes e status')
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all registered ratholes and status')
    ),
  new SlashCommandBuilder()
    .setName('ajuda')
    .setDescription('Mostra todos os comandos do bot TEKOli'),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all TEKOli bot commands (English & Portuguese)'),
].map((cmd) => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🔄 Registrando slash commands no Discord...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('✅ Slash commands registrados com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao registrar comandos:', error);
  }
})();
