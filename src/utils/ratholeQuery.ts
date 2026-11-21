import { DiscordEmbed, DiscordMessage, ProximityResult, Rathole } from '../types/rathole';

export function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function findNearestRatholes(
  ratholes: Rathole[],
  targetX: number,
  targetY: number,
  limit: number = 3
): ProximityResult[] {
  return ratholes
    .map((rh) => ({
      rathole: rh,
      distance: calculateDistance(targetX, targetY, rh.coords.x, rh.coords.y),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

export interface BotResponse {
  content: string;
  embed?: DiscordEmbed;
  type: 'rathole_info' | 'proximity' | 'list' | 'owner_search' | 'help' | 'general' | 'not_found' | 'chat';
  highlightIds?: string[];
  language?: 'en' | 'pt' | 'es' | 'de' | 'fr';
}

export type SupportedLanguage = 'auto' | 'en' | 'pt' | 'es' | 'de' | 'fr';

/**
 * Detect language of query:
 * English is the primary/preferred language.
 * Portuguese, French, German, and Spanish are recognized and respected.
 */
export function detectQueryLanguage(query: string, preferred: SupportedLanguage = 'auto'): 'en' | 'pt' | 'es' | 'de' | 'fr' {
  if (preferred === 'en' || preferred === 'pt' || preferred === 'es' || preferred === 'de' || preferred === 'fr') {
    return preferred;
  }

  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const ptIndicators = [
    'quem', 'pertence', 'dono', 'donos', 'proximo', 'proximos', 'perto', 'livre', 'livres',
    'disponivel', 'disponiveis', 'responsavel', 'responsaveis', 'ajuda', 'comandos', 'listar',
    'qual o', 'quais os', 'onde fica', 'toca', 'buraco', 'propriedade', 'bom dia', 'boa tarde',
    'boa noite', 'valeu', 'obrigado', 'tudo bem', 'como vai', 'fala ai'
  ];

  const frIndicators = [
    'qui', 'appartient', 'possede', 'proprietaire', 'proprietaires', 'coproprietaire', 'responsable',
    'responsables', 'proche', 'proches', 'pres', 'pres de', 'libre', 'libres', 'disponible',
    'aide', 'commandes', 'liste', 'lister', 'quel', 'quels', 'quelle', 'quelles', 'ou est',
    'coordonnees', 'bonjour', 'bonsoir', 'bonne nuit', 'salut', 'merci', 'ca va', 'comment ca va',
    'qui es-tu', 'qui es tu', 'bien joue', 'trou'
  ];

  const deIndicators = [
    'welche', 'welcher', 'welches', 'hat', 'haben', 'besitzt', 'wem', 'gehort', 'gehoert',
    'nahe', 'naehe', 'besitzer', 'eigentumer', 'verantwortlich', 'frei', 'guten morgen',
    'guten tag', 'guten abend', 'gute nacht', 'wie geht', 'danke', 'hallo', 'hilfe', 'wo ist'
  ];

  const esIndicators = [
    'quien', 'pertenece', 'dueno', 'duenos', 'cerca', 'cercano', 'cercanos', 'disponible',
    'disponibles', 'ayuda', 'donde esta', 'buenos dias', 'buenas tardes', 'buenas noches', 'gracias'
  ];

  const enIndicators = [
    'who', 'whose', 'owns', 'owner', 'owners', 'near', 'nearest', 'close', 'closest',
    'free', 'available', 'responsible', 'list', 'help', 'commands', 'what is', 'where is',
    'which', 'tell me', 'find', 'distance', 'vacant', 'good morning', 'good afternoon',
    'good night', 'good evening', 'how are you', 'thanks', 'thank you', 'hello', 'hey'
  ];

  const hasWord = (text: string, term: string) =>
    new RegExp(`(^|[^a-z0-9_])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9_]|$)`, 'i').test(text);

  const ptScore = ptIndicators.filter((w) => hasWord(q, w)).length;
  const frScore = frIndicators.filter((w) => hasWord(q, w)).length;
  const deScore = deIndicators.filter((w) => hasWord(q, w)).length;
  const esScore = esIndicators.filter((w) => hasWord(q, w)).length;
  const enScore = enIndicators.filter((w) => hasWord(q, w)).length;

  const maxOther = Math.max(ptScore, frScore, deScore, esScore);
  if (maxOther > enScore) {
    if (frScore >= ptScore && frScore >= deScore && frScore >= esScore) return 'fr';
    if (deScore >= ptScore && deScore >= esScore && deScore >= frScore) return 'de';
    if (ptScore >= deScore && ptScore >= esScore && ptScore >= frScore) return 'pt';
    if (esScore > ptScore && esScore > deScore && esScore > frScore) return 'es';
  }
  // Default to English as requested ("preferencialmente ingles")
  return 'en';
}

export interface AdminUpdateCommand {
  numero: number;
  field: 'status' | 'owner' | 'coOwner' | 'tp' | 'notes' | 'name';
  value: string;
}

export function normalizeRatholeStatus(rawStatus: string): string {
  const trimmed = rawStatus.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'ocupado' || lower === 'occupied') return 'ocupado';
  if (lower === 'livre' || lower === 'free' || lower === 'available') return 'livre';
  if (lower === 'aliado' || lower === 'allied') return 'aliado';
  if (lower === 'em_raid' || lower === 'em raid' || lower === 'under raid' || lower === 'raid') return 'em_raid';
  if (lower === 'reserva' || lower === 'reserve') return 'reserva';
  // Title-case custom statuses like "builded" -> "Builded"
  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function parseAdminUpdateCommand(query: string): AdminUpdateCommand | null {
  const cleaned = query.replace(/^@tekoli[\s,:-]*/i, '').trim();
  const hasUpdateVerb = /\b(update|set|change|edit|modify|atualizar|atualize|alterar|altere|mudar|mude|definir|defina|setar|andern|aendern|aktualisieren|mettre|modifier|changer|definir)\b/i.test(
    cleaned
  );
  if (!hasUpdateVerb) return null;

  const numMatch = cleaned.match(/(?:rathole|rh|base|#)\s*(?:numero|number|n[º°]|num)?\s*(\d+)/i);
  if (!numMatch) return null;
  const numero = parseInt(numMatch[1], 10);
  if (isNaN(numero)) return null;

  let field: AdminUpdateCommand['field'] | null = null;
  if (/\b(?:co-?owner|co\s+owner|coowner|co-?propri[eé]taire)\b/i.test(cleaned)) {
    field = 'coOwner';
  } else if (/\b(?:owner|dono|besitzer|propri[eé]taire)\b/i.test(cleaned)) {
    field = 'owner';
  } else if (/\b(?:tp|teleport|t[eé]l[eé]port)\b/i.test(cleaned)) {
    field = 'tp';
  } else if (/\b(?:notes?|notas?|obs|observac(?:ao|oes))\b/i.test(cleaned)) {
    field = 'notes';
  } else if (/\b(?:name|nome|nom)\b/i.test(cleaned)) {
    field = 'name';
  } else if (/\b(?:status|estado|statut)\b/i.test(cleaned)) {
    field = 'status';
  }

  if (!field) return null;

  let rawValue = '';
  const quotedMatch = cleaned.match(/["'“”«»]([^"'“”«»]+)["'“”«»]/);
  if (quotedMatch) {
    rawValue = quotedMatch[1].trim();
  } else {
    const toMatch = cleaned.match(
      /(?:to|para|as|zu|auf|en|a|=|:)\s+(.+?)(?=\s+(?:for|of|in|on|no|na|do|da|bei|fur|pour|du|sur)\s+(?:rathole|rh|base|#)|$)/i
    );
    if (toMatch) {
      rawValue = toMatch[1].trim();
    }
  }

  if (!rawValue) return null;

  const finalValue = field === 'status' ? normalizeRatholeStatus(rawValue) : rawValue;
  return { numero, field, value: finalValue };
}

export function parseLocalRatholeQuery(
  query: string,
  ratholes: Rathole[] = [],
  preferredLang: SupportedLanguage = 'auto'
): BotResponse {
  const raw = query.replace(/^@tekoli[\s,:-]*/i, '').trim();
  const q = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // strip accents
  const lang = detectQueryLanguage(raw, preferredLang);

  const wordCount = q.split(/\s+/).filter(Boolean).length;

  // 0. Short standalone conversational greetings:
  const isGoodMorning =
    wordCount <= 4 &&
    (q === 'good morning' ||
      q.startsWith('good morning') ||
      q === 'morning' ||
      q === 'gm' ||
      q === 'bom dia' ||
      q.startsWith('bom dia') ||
      q === 'bonjour' ||
      q.startsWith('bonjour') ||
      q === 'guten morgen' ||
      q.startsWith('guten morgen') ||
      q === 'buenos dias');

  if (isGoodMorning) {
    if (lang === 'pt') {
      return {
        content: `☀️ **Bom dia, guerreiro!** TEKOli pronto e em prontidão de combate! Todos os **${ratholes.length} ratholes** do clã estão monitorados no radar e sincronizados no MongoDB. Nossas defesas estão ativas. O que você precisa hoje — coordenadas, teleports ou trocar uma ideia sobre estratégia?`,
        embed: {
          title: '☀️ Relatório Matinal Tático • TEKOli',
          description: `Bom dia, companheiro de clã! Aqui está o resumo matinal das nossas bases:`,
          color: '#f59e0b',
          fields: [
            { name: '🛡️ Ratholes Monitorados', value: `**${ratholes.length}** posições ativas`, inline: true },
            { name: '🟢 Vagas Livres', value: `**${ratholes.filter((r) => r.status === 'livre').length}** disponíveis`, inline: true },
            { name: '⚡ Teleports', value: 'Consulte com `/tp` ou nome', inline: true },
            { name: '💡 Prontidão Tática', value: 'Experimente: *"A quem pertence o rathole 3?"*, *"Próximo de 12, 20"* ou converse comigo livremente!', inline: false },
          ],
          footer: { text: 'TEKOli Bot • Pronto para combate e exploração' },
        },
        type: 'chat',
        language: 'pt',
      };
    }

    if (lang === 'fr') {
      return {
        content: `☀️ **Bonjour, guerrier !** TEKOli est prêt au combat ! Les **${ratholes.length} ratholes** du clan sont surveillés sur le radar et synchronisés avec MongoDB. De quoi as-tu besoin aujourd'hui — coordonnées, téléports ou stratégie ?`,
        embed: {
          title: '☀️ Briefing Tactique Matinal • TEKOli',
          description: `Bonjour camarade ! Voici le statut actuel de notre réseau de bases :`,
          color: '#f59e0b',
          fields: [
            { name: '🛡️ Ratholes Surveillés', value: `**${ratholes.length}** positions actives`, inline: true },
            { name: '🟢 Places Libres', value: `**${ratholes.filter((r) => r.status === 'livre').length}** disponibles`, inline: true },
            { name: '⚡ Téléports', value: 'Recherche rapide via `/tp`', inline: true },
            { name: '💡 Prêt à aider', value: 'Essaie : *"À qui appartient le rathole 3 ?"*, *"Proche de 12, 20"* ou discute avec moi !', inline: false },
          ],
          footer: { text: 'TEKOli Bot • Prêt pour le combat et l’exploration' },
        },
        type: 'chat',
        language: 'fr',
      };
    }

    if (lang === 'de') {
      return {
        content: `☀️ **Guten Morgen, Krieger!** TEKOli ist einsatzbereit! Alle **${ratholes.length} Clan-Ratholes** werden auf unserem taktischen Radar überwacht und sind mit MongoDB synchronisiert. Was brauchst du heute — Koordinaten, Teleports oder taktische Beratung?`,
        embed: {
          title: '☀️ Taktischer Morgenbericht • TEKOli',
          description: `Guten Morgen, Clan-Mitglied! Hier ist der aktuelle Status unseres Basis-Netzwerks:`,
          color: '#f59e0b',
          fields: [
            { name: '🛡️ Überwachte Ratholes', value: `**${ratholes.length}** aktive Positionen`, inline: true },
            { name: '🟢 Freie Plätze', value: `**${ratholes.filter((r) => r.status === 'livre').length}** frei`, inline: true },
            { name: '⚡ Teleports', value: 'Schnellabfrage mit `/tp`', inline: true },
            { name: '💡 Einsatzbereit', value: 'Teste: *"Welche Ratholes hat @MisSy?"*, *"Wem gehört Rathole 3?"* oder chatte einfach mit mir!', inline: false },
          ],
          footer: { text: 'TEKOli Bot • Einsatzbereit für Kampf & Erkundung' },
        },
        type: 'chat',
        language: 'de',
      };
    }

    return {
      content: `☀️ **Good morning, warrior!** TEKOli standing by on high alert. All **${ratholes.length} clan ratholes** are monitored on our tactical radar and synced with MongoDB. Perimeters are secure. What coordinates, teleports, or tactical intel do you need today?`,
      embed: {
        title: '☀️ Tactical Morning Briefing • TEKOli',
        description: `Rise and shine, clanmate! Here is the morning tactical status of our base network:`,
        color: '#f59e0b',
        fields: [
          { name: '🛡️ Ratholes Monitored', value: `**${ratholes.length}** positions active`, inline: true },
          { name: '🟢 Available Spots', value: `**${ratholes.filter((r) => r.status === 'livre').length}** free`, inline: true },
          { name: '⚡ Teleports', value: 'Instant lookup with `/tp`', inline: true },
          { name: '💡 Ready to Assist', value: 'Try: *"Who owns rathole 3?"*, *"Nearest ratholes to 12, 20"*, or chat with me about strategy!', inline: false },
        ],
        footer: { text: 'TEKOli Bot • Ready for combat & exploration' },
      },
      type: 'chat',
      language: lang,
    };
  }

  // "good afternoon", "boa tarde", "guten tag", "bon apres-midi"
  const isGoodAfternoon =
    wordCount <= 4 &&
    (q === 'good afternoon' ||
      q.startsWith('good afternoon') ||
      q === 'boa tarde' ||
      q.startsWith('boa tarde') ||
      q === 'bon apres-midi' ||
      q === 'bon apres midi' ||
      q === 'guten tag' ||
      q.startsWith('guten tag'));

  if (isGoodAfternoon) {
    return {
      content:
        lang === 'pt'
          ? `🌤️ **Boa tarde, guerreiro!** TEKOli na escuta e monitorando todas as defesas. Precisa de coordenadas de teleporte ou quer conversar sobre a estratégia de algum rathole?`
          : lang === 'fr'
          ? `🌤️ **Bon après-midi, guerrier !** TEKOli à l'écoute. Tous les **${ratholes.length} ratholes** du clan sont intacts. Besoin de coordonnées ou d'infos de téléport ?`
          : lang === 'de'
          ? `🌤️ **Guten Tag, Krieger!** TEKOli ist auf Empfang. Alle **${ratholes.length} Clan-Ratholes** sind intakt. Brauchst du Teleport-Koordinaten oder Besitzer-Infos?`
          : `🌤️ **Good afternoon, soldier!** TEKOli reporting for duty. All **${ratholes.length} clan ratholes** are intact. Need any teleport coordinates, base locations, or tactical chat?`,
      type: 'chat',
      language: lang,
    };
  }

  // "good night", "boa noite", "gn", "gute nacht", "bonsoir", "bonne nuit"
  const isGoodNight =
    wordCount <= 4 &&
    (q === 'good night' ||
      q === 'good evening' ||
      q.startsWith('good night') ||
      q === 'gn' ||
      q === 'boa noite' ||
      q.startsWith('boa noite') ||
      q === 'bonsoir' ||
      q === 'bonne nuit' ||
      q.startsWith('bonsoir') ||
      q === 'gute nacht' ||
      q === 'guten abend');

  if (isGoodNight) {
    return {
      content:
        lang === 'pt'
          ? `🌙 **Boa noite, guerreiro!** Descanse bem. O TEKOli continuará de vigília no radar tático monitorando todos os **${ratholes.length} ratholes** e torretas da tribo. As defesas estão ativas!`
          : lang === 'fr'
          ? `🌙 **Bonsoir / Bonne nuit, guerrier !** Repose-toi bien. TEKOli garde la veille radar active sur les **${ratholes.length} ratholes** et les tourelles de la tribu !`
          : lang === 'de'
          ? `🌙 **Gute Nacht, Krieger!** Schlaf gut. TEKOli behält alle **${ratholes.length} Clan-Ratholes** auf dem taktischen Radar im Blick!`
          : `🌙 **Good night, warrior!** Rest well. TEKOli is keeping active radar watch over all **${ratholes.length} clan ratholes** and turret grids while you sleep. The tribe is safe!`,
      type: 'chat',
      language: lang,
    };
  }

  // "how are you", "how's it going", "tudo bem", "como vai", "wie geht", "ca va"
  const isHowAreYou =
    wordCount <= 5 &&
    (q.includes('how are you') ||
      q.includes("how's it going") ||
      q.includes('how are you doing') ||
      q.includes('tudo bem') ||
      q.includes('como vai') ||
      q.includes('como voce esta') ||
      q.includes('como esta') ||
      q.includes('ca va') ||
      q.includes('comment ca va') ||
      q.includes('comment vas') ||
      q.includes('wie geht'));

  if (isHowAreYou) {
    return {
      content:
        lang === 'pt'
          ? `🛡️ **100% de Prontidão Operacional!** Conexão com MongoDB ativa, radar em tempo real e todos os **${ratholes.length} ratholes** mapeados. Como posso apoiar o clã no combate agora?`
          : lang === 'fr'
          ? `🛡️ **100% Opérationnel !** Connexion MongoDB active, radar en temps réel et **${ratholes.length} ratholes** indexés. Comment puis-je aider la tribu ?`
          : lang === 'de'
          ? `🛡️ **100% Einsatzbereit!** MongoDB-Verbindung steht, Radar ist aktiv und alle **${ratholes.length} Ratholes** sind indexiert. Wie kann ich dir helfen?`
          : `🛡️ **100% Combat Operational!** MongoDB connection is solid, tactical radar is active, and all **${ratholes.length} ratholes** are indexed. How can I back you up on the battlefield today?`,
      type: 'chat',
      language: lang,
    };
  }

  // "hello", "hi", "hey", "yo", "sup", "ola", "oi", "salve", "hallo", "salut", "coucou"
  const isHello =
    q === 'hello' ||
    q === 'hi' ||
    q === 'hey' ||
    q === 'yo' ||
    q === 'sup' ||
    q === "what's up" ||
    q === 'ola' ||
    q === 'oi' ||
    q === 'salve' ||
    q === 'fala ai' ||
    q === 'opa' ||
    q === 'salut' ||
    q === 'coucou' ||
    q === 'hallo' ||
    q === 'servus';

  if (isHello) {
    return {
      content:
        lang === 'pt'
          ? `👋 **Salve, guerreiro!** Sou o **TEKOli**, o bot tático do clã. Pode me perguntar *"A quem pertence o rathole 3?"*, *"Próximo de 12, 20"* ou usar filtros como *"dono Clutch"* e *"responsavel Joey"*!`
          : lang === 'fr'
          ? `👋 **Salut, guerrier !** Je suis **TEKOli**, le bot tactique du clan. Tu peux me demander *"À qui appartient le rathole 3 ?"*, *"Proche de 12, 20"*, ou discuter librement avec moi !`
          : lang === 'de'
          ? `👋 **Hallo, Krieger!** Ich bin **TEKOli**, der taktische Rathole-Bot. Frag mich z.B. *"Welche Ratholes hat @MisSy?"*, *"Wem gehört Rathole 3?"* oder *"In der Nähe von 12, 20"*!`
          : `👋 **Hey there, clanmate!** I am **TEKOli**, the tactical rathole bot. You can ask me questions like *"Who owns rathole 3?"*, *"Nearest ratholes to 12, 20"*, or *"owner Clutch"*!`,
      type: 'chat',
      language: lang,
    };
  }

  // "thanks", "thank you", "obrigado", "valeu", "ty", "danke", "merci"
  const isThanks =
    q === 'thanks' ||
    q === 'thank you' ||
    q === 'ty' ||
    q === 'thx' ||
    q === 'obrigado' ||
    q === 'valeu' ||
    q === 'vlw' ||
    q === 'gracias' ||
    q === 'merci' ||
    q === 'danke' ||
    q.startsWith('obrigado') ||
    q.startsWith('valeu') ||
    q.startsWith('merci') ||
    q.startsWith('danke');

  if (isThanks) {
    return {
      content:
        lang === 'pt'
          ? `🫡 **Sempre às ordens, guerreiro! Pela tribo!** Se precisar de mais coordenadas ou teleports, é só chamar no rádio.`
          : lang === 'fr'
          ? `🫡 **Toujours à ton service, guerrier ! Pour la tribu !** N'hésite pas si tu as besoin d'un autre téléport ou de coordonnées.`
          : lang === 'de'
          ? `🫡 **Immer zu Diensten, Krieger! Für den Stamm!** Sag Bescheid, wenn du weitere Teleports oder Koordinaten brauchst.`
          : `🫡 **Always at your service, warrior! For the tribe!** Shout if you need another teleport or proximity check.`,
      type: 'chat',
      language: lang,
    };
  }

  // "who are you", "quem e voce", "what are you", "qui es tu"
  const isWhoAreYou =
    q.includes('who are you') ||
    q.includes('quem e voce') ||
    q.includes('o que voce faz') ||
    q.includes('what do you do') ||
    q.includes('qui es tu') ||
    q.includes('qui es-tu') ||
    q.includes('que fais-tu') ||
    q.includes('wer bist du');

  if (isWhoAreYou) {
    return {
      content:
        lang === 'pt'
          ? `🤖 Eu sou o **TEKOli**, o bot tático oficial do clã para ARK/Rust! Conectado ao MongoDB, gerencio todos os **${ratholes.length} ratholes**, calculo proximidade geográfica \`(xx, yy)\`, acompanho Donos e Responsáveis e forneço teleports \`/tp\` instantâneos.`
          : lang === 'fr'
          ? `🤖 Je suis **TEKOli**, le bot tactique officiel du clan pour ARK/Rust ! Connecté à MongoDB, je gère les **${ratholes.length} ratholes**, calcule les distances \`(xx, yy)\`, suis les Propriétaires & Co-Owners et fournis les téléports \`/tp\` instantanément.`
          : lang === 'de'
          ? `🤖 Ich bin **TEKOli**, der offizielle taktische Discord-Bot unseres Clans! Mit MongoDB verbunden verwalte ich alle **${ratholes.length} Ratholes**, berechne Distanzen \`(xx, yy)\`, verfolge Owner & Co-Owner und liefere sofortige \`/tp\`-Teleports.`
          : `🤖 I am **TEKOli**, the official tactical Discord bot for our competitive gaming tribe! Connected to MongoDB, I manage all **${ratholes.length} clan ratholes**, calculate GPS proximity distances \`(xx, yy)\`, track Owners & Co-Owners, and provide instant \`/tp\` teleports.`,
      type: 'chat',
      language: lang,
    };
  }

  // "gg", "good game", "boa", "bien joue"
  const isGg = q === 'gg' || q === 'good game' || q === 'parabens' || q === 'boa' || q === 'well played' || q === 'bien joue';

  if (isGg) {
    return {
      content:
        lang === 'pt'
          ? `🏆 **GG! Excelente combate, clã!** Nossas posições permanecem firmes e invictas. Vitória da tribo!`
          : lang === 'fr'
          ? `🏆 **GG ! Superbe combat, la tribu !** Nos positions tiennent bon et restent invaincues !`
          : `🏆 **GG! Outstanding fight, tribe!** Defenses held strong and our positions remain undefeated.`,
      type: 'chat',
      language: lang,
    };
  }

  // 1. Proximity queries:
  const proximityRegexes = [
    // EN: nearest / near / closest / around
    /(?:near|nearest|close|closest|around|proximity)\s*(?:to|at)?\s*\(?\s*(\d+(?:[.,]\d+)?)\s*(?:,|\s|and)\s*(\d+(?:[.,]\d+)?)\s*\)?/i,
    /\/rathole\s+(?:near|proximo|cerca|proche)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)/i,
    // PT/ES/DE/FR: proximo / perto / vizinho / cerca / nahe / proche / pres
    /(?:proximo|proximos|perto|vizinho|cerca|cercano|distancia|nahe|naehe|nah|entfernung|proche|proches|pres)[\s\w]*?(?:de|a|von|bei|zu|du|des)?\s*\(?\s*(\d+(?:[.,]\d+)?)\s*(?:,|\s|e|y|und|et)\s*(\d+(?:[.,]\d+)?)\s*\)?/i,
    // Raw coords: 12, 20 or (12.5, 80.1)
    /(\d+(?:[.,]\d+)?)\s*,\s*(\d+(?:[.,]\d+)?)/i,
  ];

  for (const regex of proximityRegexes) {
    if (
      regex === proximityRegexes[3] &&
      !q.includes('perto') &&
      !q.includes('proxim') &&
      !q.includes('near') &&
      !q.includes('close') &&
      !q.includes('coord') &&
      !q.includes('onde') &&
      !q.includes('where') &&
      !q.includes('cerca') &&
      !q.includes('proche') &&
      !q.includes('pres') &&
      !q.includes('nahe') &&
      !q.includes('wo')
    ) {
      continue;
    }

    const match = raw.match(regex);
    if (match) {
      const x = parseFloat(match[1].replace(',', '.'));
      const y = parseFloat(match[2].replace(',', '.'));

      if (!isNaN(x) && !isNaN(y)) {
        const nearest = findNearestRatholes(ratholes, x, y, 4);

        if (nearest.length === 0) {
          return {
            content:
              lang === 'pt'
                ? `❌ Nenhum rathole registrado na base de dados para comparar com as coordenadas **(${x.toFixed(1)}, ${y.toFixed(1)})**.`
                : lang === 'de'
                ? `❌ Keine Ratholes in der Datenbank gefunden, um sie mit den Koordinaten **(${x.toFixed(1)}, ${y.toFixed(1)})** zu vergleichen.`
                : `❌ No ratholes registered in the database to compare with coordinates **(${x.toFixed(1)}, ${y.toFixed(1)})**.`,
            type: 'not_found',
            language: lang,
          };
        }

        const top = nearest[0].rathole;

        if (lang === 'pt') {
          const embed: DiscordEmbed = {
            title: `🎯 Radar TEKOli • Ratholes Próximos de (${x.toFixed(1)}, ${y.toFixed(1)})`,
            description: `Identifiquei os **${nearest.length} ratholes mais próximos** do ponto tático informado:`,
            color: '#5865F2',
            fields: nearest.map((item, index) => {
              const rh = item.rathole;
              const dist = item.distance.toFixed(1);
              const statusBadge =
                rh.status === 'ocupado'
                  ? '🔒 Ocupado'
                  : rh.status === 'livre'
                  ? '🟢 Livre'
                  : rh.status === 'em_raid'
                  ? '🚨 EM RAID'
                  : '🛡️ Aliado';

              return {
                name: `${index === 0 ? '⭐ Mais Próximo: ' : ''}#${rh.numero} - ${rh.name} [${dist}m de distância]`,
                value: `👤 **Owner:** ${rh.owner}\n👥 **Co-Owner:** ${rh.coOwner}\n📍 **Coordenadas:** \`(${rh.coords.x.toFixed(1)}, ${rh.coords.y.toFixed(1)})\`\n⚡ **TP:** \`${rh.tp}\`  *(Comando: \`/tp ${rh.coords.x.toFixed(1)} ${rh.coords.y.toFixed(1)}\`)*\n🏷️ **Status:** ${statusBadge}`,
                inline: false,
              };
            }),
            footer: {
              text: 'TEKOli Bot • Sistema Tático de Defesa & Teleports',
            },
          };

          return {
            content: `📡 **Radar TEKOli:** Os ratholes mais próximos de **(${x.toFixed(1)}, ${y.toFixed(1)})** foram localizados! O mais perto é o **Rathole #${top.numero}** (${top.name}) a **${nearest[0].distance.toFixed(1)} unidades**, pertencente a **${top.owner}** com TP \`${top.tp}\`.`,
            embed,
            type: 'proximity',
            highlightIds: nearest.map((n) => n.rathole.id),
            language: 'pt',
          };
        }

        if (lang === 'de') {
          const embed: DiscordEmbed = {
            title: `🎯 TEKOli Radar • Ratholes in der Nähe von (${x.toFixed(1)}, ${y.toFixed(1)})`,
            description: `Die **${nearest.length} nächstgelegenen Ratholes** zu den angegebenen Koordinaten:`,
            color: '#5865F2',
            fields: nearest.map((item, index) => {
              const rh = item.rathole;
              const dist = item.distance.toFixed(1);
              const statusBadge =
                rh.status === 'ocupado'
                  ? '🔒 Besetzt'
                  : rh.status === 'livre'
                  ? '🟢 Frei'
                  : rh.status === 'em_raid'
                  ? '🚨 UNTER RAID'
                  : '🛡️ Verbündet';

              return {
                name: `${index === 0 ? '⭐ Am nächsten: ' : ''}#${rh.numero} - ${rh.name} [${dist}m entfernt]`,
                value: `👤 **Owner:** ${rh.owner}\n👥 **Co-Owner:** ${rh.coOwner}\n📍 **Koordinaten:** \`(${rh.coords.x.toFixed(1)}, ${rh.coords.y.toFixed(1)})\`\n⚡ **TP:** \`${rh.tp}\` *(Konsole: \`/tp ${rh.coords.x.toFixed(1)} ${rh.coords.y.toFixed(1)}\`)*\n🏷️ **Status:** ${statusBadge}`,
                inline: false,
              };
            }),
            footer: {
              text: 'TEKOli Bot • Taktisches Radar & Teleport-System',
            },
          };

          return {
            content: `📡 **TEKOli Radar:** Die nächstgelegenen Ratholes zu **(${x.toFixed(1)}, ${y.toFixed(1)})** wurden lokalisiert! Am nächsten ist **Rathole #${top.numero}** (${top.name}, **${nearest[0].distance.toFixed(1)} Einheiten**), gehört **${top.owner}** (TP: \`${top.tp}\`).`,
            embed,
            type: 'proximity',
            highlightIds: nearest.map((n) => n.rathole.id),
            language: 'de',
          };
        }

        if (lang === 'fr') {
          const embed: DiscordEmbed = {
            title: `🎯 Radar TEKOli • Ratholes proches de (${x.toFixed(1)}, ${y.toFixed(1)})`,
            description: `Voici les **${nearest.length} ratholes les plus proches** des coordonnées indiquées :`,
            color: '#5865F2',
            fields: nearest.map((item, index) => {
              const rh = item.rathole;
              const dist = item.distance.toFixed(1);
              const statusBadge =
                rh.status === 'ocupado'
                  ? '🔒 Occupé'
                  : rh.status === 'livre'
                  ? '🟢 Libre'
                  : rh.status === 'em_raid'
                  ? '🚨 SOUS RAID'
                  : `🏷️ ${rh.status}`;

              return {
                name: `${index === 0 ? '⭐ Plus proche : ' : ''}#${rh.numero} - ${rh.name} [${dist}m]`,
                value: `👤 **Owner :** ${rh.owner}\n👥 **Co-Owner :** ${rh.coOwner}\n📍 **Coords :** \`(${rh.coords.x.toFixed(1)}, ${rh.coords.y.toFixed(1)})\`\n⚡ **TP :** \`${rh.tp}\` *(Console : \`/tp ${rh.coords.x.toFixed(1)} ${rh.coords.y.toFixed(1)}\`)*\n🏷️ **Statut :** ${statusBadge}`,
                inline: false,
              };
            }),
            footer: {
              text: 'TEKOli Bot • Radar Tactique & Téléports',
            },
          };

          return {
            content: `📡 **Radar TEKOli :** Les ratholes les plus proches de **(${x.toFixed(1)}, ${y.toFixed(1)})** ont été localisés ! Le plus proche est le **Rathole #${top.numero}** (${top.name}) à **${nearest[0].distance.toFixed(1)} unités**, appartenant à **${top.owner}** (TP : \`${top.tp}\`).`,
            embed,
            type: 'proximity',
            highlightIds: nearest.map((n) => n.rathole.id),
            language: 'fr',
          };
        }

        const embed: DiscordEmbed = {
          title: `🎯 TEKOli Radar • Ratholes Near (${x.toFixed(1)}, ${y.toFixed(1)})`,
          description: `Identified the **${nearest.length} nearest ratholes** to the specified tactical coordinates:`,
          color: '#5865F2',
          fields: nearest.map((item, index) => {
            const rh = item.rathole;
            const dist = item.distance.toFixed(1);
            const statusBadge =
              rh.status === 'ocupado'
                ? '🔒 Occupied'
                : rh.status === 'livre'
                ? '🟢 Available'
                : rh.status === 'em_raid'
                ? '🚨 UNDER RAID'
                : '🛡️ Allied';

            return {
              name: `${index === 0 ? '⭐ Closest: ' : ''}#${rh.numero} - ${rh.name} [${dist}m away]`,
              value: `👤 **Owner:** ${rh.owner}\n👥 **Co-Owner:** ${rh.coOwner}\n📍 **Coordinates:** \`(${rh.coords.x.toFixed(1)}, ${rh.coords.y.toFixed(1)})\`\n⚡ **TP:** \`${rh.tp}\` *(Console: \`/tp ${rh.coords.x.toFixed(1)} ${rh.coords.y.toFixed(1)}\`)*\n🏷️ **Status:** ${statusBadge}`,
              inline: false,
            };
          }),
          footer: {
            text: 'TEKOli Bot • Tactical Defense & Teleports System',
          },
        };

        return {
          content: `📡 **TEKOli Radar:** The nearest ratholes to **(${x.toFixed(1)}, ${y.toFixed(1)})** have been located! The closest is **Rathole #${top.numero}** (${top.name}) at **${nearest[0].distance.toFixed(1)} units away**, owned by **${top.owner}** with TP \`${top.tp}\`.`,
          embed,
          type: 'proximity',
          highlightIds: nearest.map((n) => n.rathole.id),
          language: lang,
        };
      }
    }
  }

  // Open-ended tactical / chatbot questions should be handled by the AI Chatbot instead of rigid number/player regexes
  const isOpenChatbotIntent =
    !raw.startsWith('/') &&
    /\b(how|why|strategy|strategies|defend|defense|defence|raid|raiding|tip|tips|advice|recommend|suggest|explain|joke|story|compare|best|worst|weakness|strong|builded|underwater|land beds?|pelagornis|turret|turrets|como|porque|por que|estrategia|defender|defesa|dica|dicas|sugere|sugestao|explica|piada|historia|comparar|melhor|pior|ponto fraco|subaquatico|torreta|torretas|comment|pourquoi|strategie|defendre|conseil|conseils|explique|blague|histoire|comparer|meilleur|pire|sous l'eau|tourelle|tourelles)\b/i.test(
      q
    );

  // 2. Specific Rathole by number:
  const numberRegex = /(?:rathole|base|buraco|toca|trou|rh|#)\s*(?:numero|number|n[º°]|num)?\s*(\d+)/i;
  const numMatch = raw.match(numberRegex);

  if (numMatch && !isOpenChatbotIntent) {
    const targetNum = parseInt(numMatch[1], 10);
    const found = ratholes.find((r) => r.numero === targetNum);

    if (found) {
      const isTpQuery = q.includes('tp') || q.includes('teleport') || q.includes('teletransporte');
      const isOwnerQuery =
        q.includes('pertence') ||
        q.includes('dono') ||
        q.includes('owner') ||
        q.includes('quem') ||
        q.includes('who') ||
        q.includes('owns') ||
        q.includes('quien') ||
        q.includes('appartient') ||
        q.includes('possede') ||
        q.includes('proprietaire') ||
        /\bqui\b/.test(q) ||
        q.includes('wem') ||
        q.includes('wer') ||
        q.includes('gehort') ||
        q.includes('gehoert') ||
        q.includes('besitz');
      const isCoordQuery =
        q.includes('coord') ||
        q.includes('onde') ||
        q.includes('where') ||
        q.includes('localiz') ||
        q.includes('ou est') ||
        q.includes('wo ist') ||
        /\bwo\b/.test(q);

      const color =
        found.status === 'ocupado'
          ? '#5865F2'
          : found.status === 'livre'
          ? '#57F287'
          : found.status === 'em_raid'
          ? '#ED4245'
          : '#FEE75C';

      if (lang === 'pt') {
        const embed: DiscordEmbed = {
          title: `🏰 Informações do Rathole #${found.numero} • ${found.name}`,
          description: `Aqui estão os dados táticos completos do **Rathole #${found.numero}**:`,
          color,
          fields: [
            { name: '👑 Owner Principal', value: `**${found.owner}**`, inline: true },
            { name: '🛡️ Co-Owner', value: `**${found.coOwner}**`, inline: true },
            { name: '🏷️ Status', value: found.status.toUpperCase(), inline: true },
            {
              name: '📍 Coordenadas (GPS)',
              value: `\`(${found.coords.x.toFixed(1)}, ${found.coords.y.toFixed(1)})\``,
              inline: true,
            },
            {
              name: '⚡ Teleport (TP)',
              value: `\`${found.tp}\`\n*(Console: \`/tp ${found.coords.x.toFixed(1)} ${found.coords.y.toFixed(1)}\`)*`,
              inline: true,
            },
            { name: '🗺️ Servidor / Mapa', value: found.server, inline: true },
          ],
          footer: {
            text: `TEKOli Bot • Última atualização: ${new Date(found.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
          },
        };

        if (found.notes) {
          embed.fields.push({
            name: '📝 Notas Táticas & Defesas',
            value: `${found.notes}${found.turretsCount ? ` (🔫 ${found.turretsCount} Heavy Turrets ativas)` : ''}`,
            inline: false,
          });
        }

        let summary = `🏰 O **Rathole #${found.numero}** (${found.name}) pertence a **${found.owner}** (Co-Owner: **${found.coOwner}**)!`;
        summary += `\n📍 Coordenadas: \`(${found.coords.x.toFixed(1)}, ${found.coords.y.toFixed(1)})\` | ⚡ TP: \`${found.tp}\``;

        if (isTpQuery) {
          summary = `⚡ O TP do **Rathole #${found.numero}** é \`${found.tp}\` (Coordenadas: \`(${found.coords.x.toFixed(1)}, ${found.coords.y.toFixed(1)})\`, Pertence a **${found.owner}**).`;
        } else if (isCoordQuery) {
          summary = `📍 As coordenadas do **Rathole #${found.numero}** são \`(${found.coords.x.toFixed(1)}, ${found.coords.y.toFixed(1)})\` (TP: \`${found.tp}\`, Dono: **${found.owner}**).`;
        } else if (isOwnerQuery) {
          summary = `👑 O **Rathole #${found.numero}** pertence a **${found.owner}** e o Co-Owner é **${found.coOwner}**! 📍 Coords: \`(${found.coords.x.toFixed(1)}, ${found.coords.y.toFixed(1)})\` | ⚡ TP: \`${found.tp}\``;
        }

        return {
          content: summary,
          embed,
          type: 'rathole_info',
          highlightIds: [found.id],
          language: 'pt',
        };
      }

      if (lang === 'de') {
        const embed: DiscordEmbed = {
          title: `🏰 Rathole #${found.numero} Info • ${found.name}`,
          description: `Vollständiger taktischer Bericht für **Rathole #${found.numero}**:`,
          color,
          fields: [
            { name: '👑 Hauptbesitzer (Owner)', value: `**${found.owner}**`, inline: true },
            { name: '🛡️ Co-Owner', value: `**${found.coOwner}**`, inline: true },
            { name: '🏷️ Status', value: found.status.toUpperCase(), inline: true },
            {
              name: '📍 Koordinaten (GPS)',
              value: `\`(${found.coords.x.toFixed(1)}, ${found.coords.y.toFixed(1)})\``,
              inline: true,
            },
            {
              name: '⚡ Teleport (TP)',
              value: `\`${found.tp}\`\n*(Konsole: \`/tp ${found.coords.x.toFixed(1)} ${found.coords.y.toFixed(1)}\`)*`,
              inline: true,
            },
            { name: '🗺️ Server / Karte', value: found.server, inline: true },
          ],
          footer: {
            text: `TEKOli Bot • Letzte Synchronisation: ${new Date(found.updatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`,
          },
        };

        if (found.notes) {
          embed.fields.push({
            name: '📝 Taktische Notizen & Verteidigung',
            value: `${found.notes}${found.turretsCount ? ` (🔫 ${found.turretsCount} Heavy Turrets aktiv)` : ''}`,
            inline: false,
          });
        }

        let summary = `🏰 **Rathole #${found.numero}** (${found.name}) gehört **${found.owner}** (Co-Owner: **${found.coOwner}**)!`;
        summary += `\n📍 Koordinaten: \`(${found.coords.x.toFixed(1)}, ${found.coords.y.toFixed(1)})\` | ⚡ TP: \`${found.tp}\``;

        if (isTpQuery) {
          summary = `⚡ Der TP für **Rathole #${found.numero}** ist \`${found.tp}\` (Koordinaten: \`(${found.coords.x.toFixed(1)}, ${found.coords.y.toFixed(1)})\`, Besitzer: **${found.owner}**).`;
        } else if (isCoordQuery) {
          summary = `📍 Die Koordinaten für **Rathole #${found.numero}** sind \`(${found.coords.x.toFixed(1)}, ${found.coords.y.toFixed(1)})\` (TP: \`${found.tp}\`, Owner: **${found.owner}**).`;
        } else if (isOwnerQuery) {
          summary = `👑 **Rathole #${found.numero}** gehört **${found.owner}** (Co-Owner: **${found.coOwner}**)! 📍 Koordinaten: \`(${found.coords.x.toFixed(1)}, ${found.coords.y.toFixed(1)})\` | ⚡ TP: \`${found.tp}\``;
        }

        return {
          content: summary,
          embed,
          type: 'rathole_info',
          highlightIds: [found.id],
          language: 'de',
        };
      }

      if (lang === 'fr') {
        const embed: DiscordEmbed = {
          title: `🏰 Infos Rathole #${found.numero} • ${found.name}`,
          description: `Rapport tactique complet pour le **Rathole #${found.numero}** :`,
          color,
          fields: [
            { name: '👑 Owner Principal', value: `**${found.owner}**`, inline: true },
            { name: '🛡️ Co-Owner', value: `**${found.coOwner}**`, inline: true },
            { name: '🏷️ Statut', value: found.status.toUpperCase(), inline: true },
            {
              name: '📍 Coordonnées (GPS)',
              value: `\`(${found.coords.x.toFixed(1)}, ${found.coords.y.toFixed(1)})\``,
              inline: true,
            },
            {
              name: '⚡ Téléport (TP)',
              value: `\`${found.tp}\`\n*(Console : \`/tp ${found.coords.x.toFixed(1)} ${found.coords.y.toFixed(1)}\`)*`,
              inline: true,
            },
            { name: '🗺️ Serveur / Carte', value: found.server, inline: true },
          ],
          footer: {
            text: `TEKOli Bot • Dernière synchro : ${new Date(found.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
          },
        };

        if (found.notes) {
          embed.fields.push({
            name: '📝 Notes Tactiques & Défenses',
            value: `${found.notes}${found.turretsCount ? ` (🔫 ${found.turretsCount} Heavy Turrets actives)` : ''}`,
            inline: false,
          });
        }

        let summary = `🏰 Le **Rathole #${found.numero}** (${found.name}) appartient à **${found.owner}** (Co-Owner : **${found.coOwner}**) !`;
        summary += `\n📍 Coordonnées : \`(${found.coords.x.toFixed(1)}, ${found.coords.y.toFixed(1)})\` | ⚡ TP : \`${found.tp}\``;

        if (isTpQuery) {
          summary = `⚡ Le TP du **Rathole #${found.numero}** est \`${found.tp}\` (Coords : \`(${found.coords.x.toFixed(1)}, ${found.coords.y.toFixed(1)})\`, Owner : **${found.owner}**).`;
        } else if (isCoordQuery) {
          summary = `📍 Les coordonnées du **Rathole #${found.numero}** sont \`(${found.coords.x.toFixed(1)}, ${found.coords.y.toFixed(1)})\` (TP : \`${found.tp}\`, Owner : **${found.owner}**).`;
        } else if (isOwnerQuery) {
          summary = `👑 Le **Rathole #${found.numero}** appartient à **${found.owner}** (Co-Owner : **${found.coOwner}**) ! 📍 Coords : \`(${found.coords.x.toFixed(1)}, ${found.coords.y.toFixed(1)})\` | ⚡ TP : \`${found.tp}\``;
        }

        return {
          content: summary,
          embed,
          type: 'rathole_info',
          highlightIds: [found.id],
          language: 'fr',
        };
      }

      const embed: DiscordEmbed = {
        title: `🏰 Rathole #${found.numero} Intel • ${found.name}`,
        description: `Complete tactical report for **Rathole #${found.numero}**:`,
        color,
        fields: [
          { name: '👑 Primary Owner', value: `**${found.owner}**`, inline: true },
          { name: '🛡️ Co-Owner', value: `**${found.coOwner}**`, inline: true },
          { name: '🏷️ Status', value: found.status.toUpperCase(), inline: true },
          {
            name: '📍 Coordinates (GPS)',
            value: `\`(${found.coords.x.toFixed(1)}, ${found.coords.y.toFixed(1)})\``,
            inline: true,
          },
          {
            name: '⚡ Teleport (TP)',
            value: `\`${found.tp}\`\n*(Console: \`/tp ${found.coords.x.toFixed(1)} ${found.coords.y.toFixed(1)}\`)*`,
            inline: true,
          },
          { name: '🗺️ Server / Map', value: found.server, inline: true },
        ],
        footer: {
          text: `TEKOli Bot • Last sync: ${new Date(found.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
        },
      };

      if (found.notes) {
        embed.fields.push({
          name: '📝 Tactical Notes & Defenses',
          value: `${found.notes}${found.turretsCount ? ` (🔫 ${found.turretsCount} Heavy Turrets active)` : ''}`,
          inline: false,
        });
      }

      let summary = `🏰 **Rathole #${found.numero}** (${found.name}) belongs to **${found.owner}** (Co-Owner: **${found.coOwner}**)!`;
      summary += `\n📍 Coordinates: \`(${found.coords.x.toFixed(1)}, ${found.coords.y.toFixed(1)})\` | ⚡ TP: \`${found.tp}\``;

      if (isTpQuery) {
        summary = `⚡ The TP for **Rathole #${found.numero}** is \`${found.tp}\` (Coordinates: \`(${found.coords.x.toFixed(1)}, ${found.coords.y.toFixed(1)})\`, Owned by **${found.owner}**).`;
      } else if (isCoordQuery) {
        summary = `📍 Coordinates for **Rathole #${found.numero}** are \`(${found.coords.x.toFixed(1)}, ${found.coords.y.toFixed(1)})\` (TP: \`${found.tp}\`, Owner: **${found.owner}**).`;
      } else if (isOwnerQuery) {
        summary = `👑 **Rathole #${found.numero}** is owned by **${found.owner}** and co-owned by **${found.coOwner}**! 📍 Coords: \`(${found.coords.x.toFixed(1)}, ${found.coords.y.toFixed(1)})\` | ⚡ TP: \`${found.tp}\``;
      }

      return {
        content: summary,
        embed,
        type: 'rathole_info',
        highlightIds: [found.id],
        language: lang,
      };
    } else {
      return {
        content:
          lang === 'pt'
            ? `🔍 O **Rathole #${targetNum}** não foi encontrado no banco de dados MongoDB. Temos cadastrados atualmente os números: ${ratholes.map((r) => `#${r.numero}`).join(', ')}.`
            : lang === 'de'
            ? `🔍 **Rathole #${targetNum}** wurde nicht in der MongoDB-Datenbank gefunden. Aktuell registriert: ${ratholes.map((r) => `#${r.numero}`).join(', ')}.`
            : `🔍 **Rathole #${targetNum}** was not found in the MongoDB database. Currently registered: ${ratholes.map((r) => `#${r.numero}`).join(', ')}.`,
        type: 'not_found',
        language: lang,
      };
    }
  }

  // 3. Search by member:
  // RULE:
  // - If NOT specified -> MUST filter strictly by OWNER!
  // - May politely ask if user also wants to see Co-Owner ratholes.
  // - "responsavel" / "responsible" / "verantwortlich" -> filters by Owner + Co-Owner.
  // - "co-owner" / "coowner" -> filters strictly by Co-Owner.
  const isResponsavelExplicit =
    q.includes('responsavel') ||
    q.includes('responsaveis') ||
    q.includes('responsible') ||
    q.includes('responsable') ||
    q.includes('responsables') ||
    q.includes('verantwortlich') ||
    raw.startsWith('/rathole responsavel') ||
    raw.startsWith('/rathole responsible');

  const isCoOwnerExplicit =
    !isResponsavelExplicit &&
    (q.includes('co-owner') ||
      q.includes('coowner') ||
      q.includes('co owner') ||
      q.includes('coproprietaire') ||
      q.includes('co-proprietaire') ||
      q.includes('mitbesitzer') ||
      raw.startsWith('/rathole coowner') ||
      raw.startsWith('/rathole co-owner'));

  const filterMode: 'owner' | 'responsible' | 'co_owner' = isResponsavelExplicit
    ? 'responsible'
    : isCoOwnerExplicit
    ? 'co_owner'
    : 'owner';

  const stopWords = new Set([
    'list', 'listar', 'liste', 'lister', 'free', 'livre', 'livres', 'libre', 'libres', 'frei',
    'all', 'todos', 'todas', 'tous', 'toutes', 'alle',
    'near', 'proximo', 'proche', 'pres', 'nahe', 'hat', 'haben', 'besitzt', 'gehoren', 'gehoeren',
    'gehort', 'gehoert', 'has', 'have', 'had', 'does', 'do', 'did', 'is', 'are', 'was', 'were',
    'est', 'sont', 'etre', 'avoir', 'possede', 'appartient',
    'ist', 'sind', 'gibt', 'gibts', 'es', 'tem', 'possui', 'tiene', 'tienen', 'been', 'being',
    'sao', 'which', 'welche', 'welcher', 'welches', 'quais', 'qual', 'quel', 'quels', 'quelle', 'quelles',
    'who', 'quem', 'qui', 'que', 'quoi',
    'wer', 'wem', 'what', 'whats', 'where', 'wo', 'when', 'why', 'how', 'the', 'der', 'die', 'das',
    'von', 'for', 'of', 'de', 'da', 'do', 'dos', 'das', 'du', 'des', 'le', 'la', 'les', 'un', 'une',
    'and', 'und', 'et', 'or', 'oder', 'ou',
    'mit', 'with', 'avec', 'sans', 'dans', 'sur', 'sous', 'pour', 'par', 'bitte', 'please',
    'mir', 'uns', 'kann', 'man', 'status', 'statut', 'builded', 'built', 'construit',
    'ocupado', 'aliado', 'reserva', 'em_raid', 'raid', 'underwater', 'water', 'lava', 'cave', 'caves',
    'bed', 'beds', 'land', 'turret', 'turrets', 'tourelle', 'tourelles', 'need', 'needs', 'strategy', 'strategie',
    'defend', 'defendre', 'defense',
    'good', 'bad', 'best', 'worst', 'meilleur', 'pire', 'more', 'many', 'much', 'some', 'any', 'about', 'that', 'this',
    'com', 'sem', 'por', 'para', 'sobre', 'como', 'onde', 'quando', 'porque', 'comment', 'pourquoi', 'quand', 'combien',
    'esse', 'essa', 'isso', 'melhor', 'pior', 'construido', 'subaquatico', 'agua', 'caverna', 'torreta', 'torretas', 'defesa'
  ]);

  // Extract player name carefully:
  // Priority 1: Slash commands
  // Priority 2: Discord @mention (e.g. @MisSy)
  // Priority 3: Known player names in database (prevents verbs like "hat" / "has" from hijacking!)
  // Priority 4: Explicit prefixes ("owner Clutch", "besitzer Beno")
  // Priority 5: Generic playerRegex with stopword guard
  let searchName = '';
  const donoCommandMatch = raw.match(/\/rathole\s+(?:dono|owner)\s+@?([a-zA-Z0-9_.-]{2,25})/i);
  const respCommandMatch = raw.match(/\/rathole\s+(?:responsavel|responsible)\s+@?([a-zA-Z0-9_.-]{2,25})/i);
  const coCommandMatch = raw.match(/\/rathole\s+(?:co-?owner)\s+@?([a-zA-Z0-9_.-]{2,25})/i);
  const mentionMatch = raw.match(/@([a-zA-Z0-9_.-]{2,32})/);

  if (donoCommandMatch) {
    searchName = donoCommandMatch[1].trim();
  } else if (respCommandMatch) {
    searchName = respCommandMatch[1].trim();
  } else if (coCommandMatch) {
    searchName = coCommandMatch[1].trim();
  } else if (mentionMatch && !['tekoli', 'everyone', 'here'].includes(mentionMatch[1].toLowerCase())) {
    searchName = mentionMatch[1].trim();
  }

  // Check known player names from DB before falling back to generic regexes
  if (
    !searchName &&
    !q.includes('livre') &&
    !q.includes('libre') &&
    !q.includes('free') &&
    !/\bfrei\b/.test(q) &&
    !q.includes('ajuda') &&
    !q.includes('aide') &&
    !q.includes('help') &&
    !q.includes('hilfe') &&
    !q.includes('comandos') &&
    !q.includes('commandes') &&
    !q.includes('listar') &&
    !q.includes('lister') &&
    !q.includes('list') &&
    q.length >= 2
  ) {
    const knownNames = Array.from(
      new Set(
        ratholes
          .flatMap((rh) => [
            rh.owner.split('(')[0].trim(),
            rh.coOwner.split('(')[0].trim(),
          ])
          .flatMap((n) => n.split('/').map((part) => part.trim()))
          .filter((n) => n.length >= 2 && n.toLowerCase() !== 'nenhum' && n.toLowerCase() !== 'none')
      )
    ).sort((a, b) => b.length - a.length);

    for (const name of knownNames) {
      const nameClean = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const wordBoundaryRegex = new RegExp(`(^|[^a-z0-9_])${nameClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9_]|$)`, 'i');
      if (wordBoundaryRegex.test(q)) {
        searchName = name;
        break;
      }
    }
  }

  // Explicit keyword regex fallback (e.g., searching for a player name not yet in DB)
  if (!searchName) {
    const explicitRegex =
      /(?:co-?owner|co\s+owner|co-?proprietaire|coproprietaire|dono|owner|dueno|proprietaire|besitzer|eigentumer|mitbesitzer|responsavel|responsible|responsable|responsaveis|verantwortlich)(?:\s+(?:do|da|de|du|des|of|for|pelo|pela|por|pour|von|fur))?\s*[:\-]?\s*@?([a-zA-Z0-9_.-]{2,20})/i;
    const explicitMatch = q.match(explicitRegex);
    if (explicitMatch && !stopWords.has(explicitMatch[1].toLowerCase())) {
      searchName = explicitMatch[1].trim();
    } else {
      const playerRegex = /(?:rathole|base|propriedade)s?\s*(?:de|do|da|du|of|by|for|pour|von|hat|haben|has|have|tem|tiene|possede|gehoren|gehoeren)?\s*@?([a-zA-Z0-9_.-]{2,20})/i;
      const playerMatch = q.match(playerRegex);
      if (playerMatch && !stopWords.has(playerMatch[1].toLowerCase())) {
        searchName = playerMatch[1].trim();
      }
    }
  }

  if (
    searchName &&
    !isOpenChatbotIntent &&
    !q.includes('livre') &&
    !q.includes('libre') &&
    !q.includes('free') &&
    !/\bfrei\b/.test(q) &&
    !q.includes('ajuda') &&
    !q.includes('aide') &&
    !q.includes('help') &&
    !q.includes('hilfe') &&
    !q.includes('comandos')
  ) {
    const targetClean = searchName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const matchesOwner = (rh: Rathole) => {
      const ownerClean = rh.owner.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return ownerClean.includes(targetClean) || (ownerClean.length >= 3 && targetClean.includes(ownerClean));
    };

    const matchesCoOwner = (rh: Rathole) => {
      const coOwnerClean = rh.coOwner.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return coOwnerClean.includes(targetClean) || (coOwnerClean.length >= 3 && targetClean.includes(coOwnerClean));
    };

    const ownerMatches = ratholes.filter(matchesOwner);
    const coOwnerOnlyMatches = ratholes.filter((rh) => matchesCoOwner(rh) && !matchesOwner(rh));

    const matches =
      filterMode === 'owner'
        ? ownerMatches
        : filterMode === 'co_owner'
        ? ratholes.filter(matchesCoOwner)
        : ratholes.filter((rh) => matchesOwner(rh) || matchesCoOwner(rh));

    if (matches.length > 0) {
      const coOwnerPromptEn =
        filterMode === 'owner' && coOwnerOnlyMatches.length > 0
          ? `\n\n💡 *Would you also like to see the **${coOwnerOnlyMatches.length} rathole(s)** where **${searchName}** is **Co-Owner**? Ask \`co-owner ${searchName}\` or \`responsible ${searchName}\`!*`
          : '';

      const coOwnerPromptPt =
        filterMode === 'owner' && coOwnerOnlyMatches.length > 0
          ? `\n\n💡 *Quer ver também os **${coOwnerOnlyMatches.length} rathole(s)** onde **${searchName}** é **Co-Owner**? Pergunte \`co-owner ${searchName}\` ou \`responsavel ${searchName}\`!*`
          : '';

      const coOwnerPromptDe =
        filterMode === 'owner' && coOwnerOnlyMatches.length > 0
          ? `\n\n💡 *Möchtest du auch die **${coOwnerOnlyMatches.length} Rathole(s)** sehen, bei denen **${searchName}** **Co-Owner** ist? Frag einfach \`co-owner ${searchName}\` oder \`responsible ${searchName}\`!*`
          : '';

      if (lang === 'pt') {
        const filterLabel =
          filterMode === 'owner'
            ? '👑 Dono (Owner Principal)'
            : filterMode === 'co_owner'
            ? '🛡️ Apenas Co-Owner'
            : '👥 Responsável (Owner e Co-Owner)';

        const embedTitle =
          filterMode === 'owner'
            ? `👑 Dono (Owner): Ratholes de "${searchName}" (${matches.length})`
            : filterMode === 'co_owner'
            ? `🛡️ Co-Owner: Ratholes de "${searchName}" (${matches.length})`
            : `👥 Responsável: Ratholes de "${searchName}" (${matches.length})`;

        const embedDesc =
          filterMode === 'owner'
            ? `Filtrando estritamente onde **${searchName}** é o **Owner Principal**:`
            : filterMode === 'co_owner'
            ? `Filtrando estritamente onde **${searchName}** é **Co-Owner**:`
            : `Filtrando onde **${searchName}** é **Responsável** (Owner ou Co-Owner):`;

        const fields = matches.slice(0, 20).map((rh) => ({
          name: `#${rh.numero} - ${rh.name}`,
          value: `👑 **Owner:** ${rh.owner}\n🛡️ **Co-Owner:** ${rh.coOwner}\n📍 **Coords:** \`(${rh.coords.x.toFixed(1)}, ${rh.coords.y.toFixed(1)})\`\n⚡ **TP:** \`${rh.tp}\` | 🏷️ **Status:** ${rh.status}`,
          inline: false,
        }));

        if (filterMode === 'owner' && coOwnerOnlyMatches.length > 0) {
          fields.push({
            name: `🛡️ Também é Co-Owner em mais ${coOwnerOnlyMatches.length} rathole(s)`,
            value: `Quer ver esses também? Digite \`co-owner ${searchName}\` ou \`responsavel ${searchName}\`.`,
            inline: false,
          });
        }

        const embed: DiscordEmbed = {
          title: embedTitle,
          description: embedDesc,
          color: filterMode === 'owner' ? '#f59e0b' : filterMode === 'co_owner' ? '#10b981' : '#5865F2',
          fields,
          footer: { text: `TEKOli Bot • Filtro: ${filterLabel}` },
        };

        const summaryText =
          filterMode === 'owner'
            ? `👑 **Filtro por Owner:** Encontrei **${matches.length} rathole(s)** onde **${searchName}** é o **Owner Principal**!${coOwnerPromptPt}`
            : filterMode === 'co_owner'
            ? `🛡️ **Filtro por Co-Owner:** Encontrei **${matches.length} rathole(s)** onde **${searchName}** é **Co-Owner**!`
            : `👥 **Filtro por Responsável:** Encontrei **${matches.length} rathole(s)** onde **${searchName}** é **Responsável (Owner ou Co-Owner)**!`;

        return {
          content: summaryText,
          embed,
          type: 'owner_search',
          highlightIds: matches.map((m) => m.id),
          language: 'pt',
        };
      }

      if (lang === 'de') {
        const filterLabel =
          filterMode === 'owner'
            ? '👑 Owner (Nur Hauptbesitzer)'
            : filterMode === 'co_owner'
            ? '🛡️ Nur Co-Owner'
            : '👥 Verantwortlich (Owner & Co-Owner)';

        const embedTitle =
          filterMode === 'owner'
            ? `👑 Owner: Ratholes von "${searchName}" (${matches.length})`
            : filterMode === 'co_owner'
            ? `🛡️ Co-Owner: Ratholes von "${searchName}" (${matches.length})`
            : `👥 Verantwortlich: Ratholes von "${searchName}" (${matches.length})`;

        const embedDesc =
          filterMode === 'owner'
            ? `Strikter Filter — wo **${searchName}** der **Hauptbesitzer (Owner)** ist:`
            : filterMode === 'co_owner'
            ? `Strikter Filter — wo **${searchName}** **Co-Owner** ist:`
            : `Filter — wo **${searchName}** **verantwortlich** ist (Owner oder Co-Owner):`;

        const fields = matches.slice(0, 20).map((rh) => ({
          name: `#${rh.numero} - ${rh.name}`,
          value: `👑 **Owner:** ${rh.owner}\n🛡️ **Co-Owner:** ${rh.coOwner}\n📍 **Koordinaten:** \`(${rh.coords.x.toFixed(1)}, ${rh.coords.y.toFixed(1)})\`\n⚡ **TP:** \`${rh.tp}\` | 🏷️ **Status:** ${rh.status}`,
          inline: false,
        }));

        if (filterMode === 'owner' && coOwnerOnlyMatches.length > 0) {
          fields.push({
            name: `🛡️ Auch Co-Owner bei ${coOwnerOnlyMatches.length} weiteren Rathole(s)`,
            value: `Möchtest du diese auch sehen? Schreib \`co-owner ${searchName}\` oder \`responsible ${searchName}\`.`,
            inline: false,
          });
        }

        const embed: DiscordEmbed = {
          title: embedTitle,
          description: embedDesc,
          color: filterMode === 'owner' ? '#f59e0b' : filterMode === 'co_owner' ? '#10b981' : '#5865F2',
          fields,
          footer: { text: `TEKOli Bot • Filter: ${filterLabel}` },
        };

        const summaryText =
          filterMode === 'owner'
            ? `👑 **Owner-Filter:** **${matches.length} Rathole(s)** gefunden, bei denen **${searchName}** der **Hauptbesitzer (Owner)** ist!${coOwnerPromptDe}`
            : filterMode === 'co_owner'
            ? `🛡️ **Co-Owner-Filter:** **${matches.length} Rathole(s)** gefunden, bei denen **${searchName}** **Co-Owner** ist!`
            : `👥 **Verantwortlich-Filter:** **${matches.length} Rathole(s)** gefunden, bei denen **${searchName}** **Owner oder Co-Owner** ist!`;

        return {
          content: summaryText,
          embed,
          type: 'owner_search',
          highlightIds: matches.map((m) => m.id),
          language: 'de',
        };
      }

      if (lang === 'fr') {
        const coOwnerPromptFr =
          filterMode === 'owner' && coOwnerOnlyMatches.length > 0
            ? `\n\n💡 *Veux-tu aussi voir les **${coOwnerOnlyMatches.length} rathole(s)** où **${searchName}** est **Co-Owner** ? Demande \`co-owner ${searchName}\` ou \`responsable ${searchName}\` !*`
            : '';

        const filterLabel =
          filterMode === 'owner'
            ? '👑 Owner (Principal uniquement)'
            : filterMode === 'co_owner'
            ? '🛡️ Co-Owner uniquement'
            : '👥 Responsable (Owner & Co-Owner)';

        const embedTitle =
          filterMode === 'owner'
            ? `👑 Owner : Ratholes de "${searchName}" (${matches.length})`
            : filterMode === 'co_owner'
            ? `🛡️ Co-Owner : Ratholes de "${searchName}" (${matches.length})`
            : `👥 Responsable : Ratholes de "${searchName}" (${matches.length})`;

        const embedDesc =
          filterMode === 'owner'
            ? `Filtre strict — où **${searchName}** est **Owner Principal** :`
            : filterMode === 'co_owner'
            ? `Filtre strict — où **${searchName}** est **Co-Owner** :`
            : `Filtre — où **${searchName}** est **Responsable** (Owner ou Co-Owner) :`;

        const fields = matches.slice(0, 20).map((rh) => ({
          name: `#${rh.numero} - ${rh.name}`,
          value: `👑 **Owner :** ${rh.owner}\n🛡️ **Co-Owner :** ${rh.coOwner}\n📍 **Coords :** \`(${rh.coords.x.toFixed(1)}, ${rh.coords.y.toFixed(1)})\`\n⚡ **TP :** \`${rh.tp}\` | 🏷️ **Statut :** ${rh.status}`,
          inline: false,
        }));

        if (filterMode === 'owner' && coOwnerOnlyMatches.length > 0) {
          fields.push({
            name: `🛡️ Également Co-Owner sur ${coOwnerOnlyMatches.length} autre(s) rathole(s)`,
            value: `Tu veux les voir aussi ? Tape \`co-owner ${searchName}\` ou \`responsable ${searchName}\`.`,
            inline: false,
          });
        }

        const embed: DiscordEmbed = {
          title: embedTitle,
          description: embedDesc,
          color: filterMode === 'owner' ? '#f59e0b' : filterMode === 'co_owner' ? '#10b981' : '#5865F2',
          fields,
          footer: { text: `TEKOli Bot • Filtre : ${filterLabel}` },
        };

        const summaryText =
          filterMode === 'owner'
            ? `👑 **Filtre Owner :** **${matches.length} rathole(s)** trouvé(s) où **${searchName}** est **Owner Principal** !${coOwnerPromptFr}`
            : filterMode === 'co_owner'
            ? `🛡️ **Filtre Co-Owner :** **${matches.length} rathole(s)** trouvé(s) où **${searchName}** est **Co-Owner** !`
            : `👥 **Filtre Responsable :** **${matches.length} rathole(s)** trouvé(s) où **${searchName}** est **Responsable (Owner ou Co-Owner)** !`;

        return {
          content: summaryText,
          embed,
          type: 'owner_search',
          highlightIds: matches.map((m) => m.id),
          language: 'fr',
        };
      }

      const filterLabel =
        filterMode === 'owner'
          ? '👑 Owner (Primary Only)'
          : filterMode === 'co_owner'
          ? '🛡️ Co-Owner Only'
          : '👥 Responsible (Owner & Co-Owner)';

      const embedTitle =
        filterMode === 'owner'
          ? `👑 Owner: Ratholes for "${searchName}" (${matches.length})`
          : filterMode === 'co_owner'
          ? `🛡️ Co-Owner: Ratholes for "${searchName}" (${matches.length})`
          : `👥 Responsible: Ratholes for "${searchName}" (${matches.length})`;

      const embedDesc =
        filterMode === 'owner'
          ? `Filtering strictly where **${searchName}** is the **Primary Owner**:`
          : filterMode === 'co_owner'
          ? `Filtering strictly where **${searchName}** is the **Co-Owner**:`
          : `Filtering where **${searchName}** is **Responsible** (Owner or Co-Owner):`;

      const fields = matches.slice(0, 20).map((rh) => ({
        name: `#${rh.numero} - ${rh.name}`,
        value: `👑 **Owner:** ${rh.owner}\n🛡️ **Co-Owner:** ${rh.coOwner}\n📍 **Coords:** \`(${rh.coords.x.toFixed(1)}, ${rh.coords.y.toFixed(1)})\`\n⚡ **TP:** \`${rh.tp}\` | 🏷️ **Status:** ${rh.status}`,
        inline: false,
      }));

      if (filterMode === 'owner' && coOwnerOnlyMatches.length > 0) {
        fields.push({
          name: `🛡️ Also Co-Owner on ${coOwnerOnlyMatches.length} more rathole(s)`,
          value: `Want to see them too? Type \`co-owner ${searchName}\` or \`responsible ${searchName}\`.`,
          inline: false,
        });
      }

      const embed: DiscordEmbed = {
        title: embedTitle,
        description: embedDesc,
        color: filterMode === 'owner' ? '#f59e0b' : filterMode === 'co_owner' ? '#10b981' : '#5865F2',
        fields,
        footer: { text: `TEKOli Bot • Filter: ${filterLabel}` },
      };

      const summaryText =
        filterMode === 'owner'
          ? `👑 **Owner Filter:** Found **${matches.length} rathole(s)** where **${searchName}** is the **Primary Owner**!${coOwnerPromptEn}`
          : filterMode === 'co_owner'
          ? `🛡️ **Co-Owner Filter:** Found **${matches.length} rathole(s)** where **${searchName}** is **Co-Owner**!`
          : `👥 **Responsible Filter:** Found **${matches.length} rathole(s)** where **${searchName}** is **Responsible (Owner or Co-Owner)**!`;

      return {
        content: summaryText,
        embed,
        type: 'owner_search',
        highlightIds: matches.map((m) => m.id),
        language: lang,
      };
    } else {
      // No matches in requested mode. If owner mode was used and they ARE co-owner somewhere, ask!
      if (filterMode === 'owner' && coOwnerOnlyMatches.length > 0) {
        return {
          content:
            lang === 'pt'
              ? `🔍 **${searchName}** não é **Owner** principal de nenhum rathole, **mas é Co-Owner em ${coOwnerOnlyMatches.length} rathole(s)**.\n💡 Quer ver onde **${searchName}** é Co-Owner? Pergunte \`co-owner ${searchName}\` ou \`responsavel ${searchName}\`!`
              : lang === 'fr'
              ? `🔍 **${searchName}** n'est pas l'**Owner** principal d'un rathole, **mais est Co-Owner sur ${coOwnerOnlyMatches.length} rathole(s)**.\n💡 Veux-tu voir où **${searchName}** est Co-Owner ? Demande \`co-owner ${searchName}\` ou \`responsable ${searchName}\` !`
              : lang === 'de'
              ? `🔍 **${searchName}** ist bei keinem Rathole der Hauptbesitzer (**Owner**), **aber Co-Owner bei ${coOwnerOnlyMatches.length} Rathole(s)**.\n💡 Möchtest du sehen, wo **${searchName}** Co-Owner ist? Frag \`co-owner ${searchName}\` oder \`responsible ${searchName}\`!`
              : `🔍 **${searchName}** is not the primary **Owner** of any rathole, **but is Co-Owner on ${coOwnerOnlyMatches.length} rathole(s)**.\n💡 Would you like to see where **${searchName}** is Co-Owner? Ask \`co-owner ${searchName}\` or \`responsible ${searchName}\`!`,
          type: 'not_found',
          language: lang,
        };
      }

      const modeTextEn =
        filterMode === 'owner'
          ? 'Owner (Primary)'
          : filterMode === 'co_owner'
          ? 'Co-Owner'
          : 'Responsible (Owner + Co-Owner)';

      const modeTextPt =
        filterMode === 'owner'
          ? 'Dono (Owner)'
          : filterMode === 'co_owner'
          ? 'Co-Owner'
          : 'Responsável (Owner + Co-Owner)';

      const modeTextFr =
        filterMode === 'owner'
          ? 'Owner (Principal)'
          : filterMode === 'co_owner'
          ? 'Co-Owner'
          : 'Responsable (Owner + Co-Owner)';

      const modeTextDe =
        filterMode === 'owner'
          ? 'Owner (Hauptbesitzer)'
          : filterMode === 'co_owner'
          ? 'Co-Owner'
          : 'Verantwortlich (Owner + Co-Owner)';

      return {
        content:
          lang === 'pt'
            ? `🔍 Nenhum rathole encontrado para **"${searchName}"** com o filtro de **${modeTextPt}**.`
            : lang === 'fr'
            ? `🔍 Aucun rathole trouvé pour **"${searchName}"** avec le filtre **${modeTextFr}**.`
            : lang === 'de'
            ? `🔍 Keine Ratholes für **"${searchName}"** mit Filter **${modeTextDe}** gefunden.`
            : `🔍 No ratholes found for **"${searchName}"** with filter **${modeTextEn}**.`,
        type: 'not_found',
        language: lang,
      };
    }
  }

  // 4. List free ratholes: "free", "available", "livres", "livre", "libre", "frei"
  if (
    q.includes('livre') ||
    q.includes('libre') ||
    q.includes('disponivel') ||
    q.includes('disponible') ||
    q.includes('vago') ||
    q.includes('desocupado') ||
    q.includes('free') ||
    q.includes('available') ||
    q.includes('vacant') ||
    q.includes('open') ||
    /\bfrei\b/.test(q)
  ) {
    const free = ratholes.filter((r) => r.status === 'livre');
    if (free.length === 0) {
      return {
        content:
          lang === 'pt'
            ? `🛡️ No momento não temos nenhum rathole classificado como **Livre**. Todos estão ocupados por membros ou aliados.`
            : lang === 'fr'
            ? `🛡️ Aucun rathole n'est actuellement classé comme **Libre**. Tous sont occupés par des membres ou des alliés.`
            : lang === 'de'
            ? `🛡️ Derzeit sind keine Ratholes als **Frei** markiert. Alle sind besetzt oder für Verbündete reserviert.`
            : `🛡️ Currently there are no ratholes classified as **Available / Free**. All are occupied by members or allies.`,
        type: 'list',
        language: lang,
      };
    }

    if (lang === 'pt') {
      const embed: DiscordEmbed = {
        title: `🟢 Ratholes Livres / Disponíveis (${free.length})`,
        description: `Ratholes desocupados prontos para novos membros ou expansão do clã:`,
        color: '#57F287',
        fields: free.map((rh) => ({
          name: `#${rh.numero} - ${rh.name}`,
          value: `📍 **Coords:** \`(${rh.coords.x.toFixed(1)}, ${rh.coords.y.toFixed(1)})\`\n⚡ **TP:** \`${rh.tp}\`\n📝 **Notas:** ${rh.notes || 'Sem observações'}`,
          inline: false,
        })),
        footer: { text: 'TEKOli Bot • Vagas para o clã' },
      };

      return {
        content: `🟢 Temos **${free.length} rathole(s) livre(s)** prontos para ocupação!`,
        embed,
        type: 'list',
        highlightIds: free.map((f) => f.id),
        language: 'pt',
      };
    }

    if (lang === 'fr') {
      const embed: DiscordEmbed = {
        title: `🟢 Ratholes Libres / Disponibles (${free.length})`,
        description: `Ratholes disponibles pour de nouveaux membres ou une expansion du clan :`,
        color: '#57F287',
        fields: free.map((rh) => ({
          name: `#${rh.numero} - ${rh.name}`,
          value: `📍 **Coords :** \`(${rh.coords.x.toFixed(1)}, ${rh.coords.y.toFixed(1)})\`\n⚡ **TP :** \`${rh.tp}\`\n📝 **Notes :** ${rh.notes || 'Aucune'}`,
          inline: false,
        })),
        footer: { text: 'TEKOli Bot • Places disponibles' },
      };

      return {
        content: `🟢 Nous avons **${free.length} rathole(s) libre(s)** prêt(s) à être occupé(s) !`,
        embed,
        type: 'list',
        highlightIds: free.map((f) => f.id),
        language: 'fr',
      };
    }

    const embed: DiscordEmbed = {
      title: lang === 'de' ? `🟢 Freie / Verfügbare Ratholes (${free.length})` : `🟢 Free / Available Ratholes (${free.length})`,
      description:
        lang === 'de'
          ? `Unbesetzte Ratholes bereit für neue Clan-Mitglieder oder Expansion:`
          : `Unoccupied ratholes ready for new members or clan tactical expansion:`,
      color: '#57F287',
      fields: free.map((rh) => ({
        name: `#${rh.numero} - ${rh.name}`,
        value: `📍 **Coords:** \`(${rh.coords.x.toFixed(1)}, ${rh.coords.y.toFixed(1)})\`\n⚡ **TP:** \`${rh.tp}\`\n📝 **Notes:** ${rh.notes || 'None'}`,
        inline: false,
      })),
      footer: { text: 'TEKOli Bot • Clan Open Spots' },
    };

    return {
      content:
        lang === 'de'
          ? `🟢 Wir haben **${free.length} freie(s) Rathole(s)** zur Besetzung verfügbar!`
          : `🟢 We have **${free.length} free rathole(s)** ready for occupation!`,
      embed,
      type: 'list',
      highlightIds: free.map((f) => f.id),
      language: lang,
    };
  }

  // 5. Help / Commands
  if (
    q.includes('ajuda') ||
    q.includes('aide') ||
    q.includes('comandos') ||
    q.includes('commandes') ||
    q.includes('help') ||
    q.includes('hilfe') ||
    q.includes('command') ||
    q.startsWith('/help') ||
    q.startsWith('/ajuda')
  ) {
    if (lang === 'pt') {
      const embed: DiscordEmbed = {
        title: `🤖 TEKOli • Central de Comandos do Bot`,
        description: `Olá! Eu sou o **TEKOli**, o bot tático do clã conectado ao banco MongoDB. Falo **Inglês** (preferencial), **Português**, **Francês**, **Alemão** e **Espanhol**. Pode falar comigo em linguagem natural ou comandos:`,
        color: '#5865F2',
        fields: [
          {
            name: '❓ Perguntas em Linguagem Natural',
            value:
              '• *"Who owns rathole 3?"* ou *"A quem pertence o rathole 3?"*\n• *"Nearest ratholes to 14.9, 85.8"* ou *"Próximo de 14.9, 85.8"*\n• *"owner Clutch"* / *"welche ratholes hat @MisSy"* (apenas Owner Principal)\n• *"responsible Joey"* ou *"responsavel Joey"* (Owner ou Co-Owner)\n• *"What is the TP for rathole 1?"* ou *"Qual o TP do rathole 1?"*\n• *"Free ratholes"* ou *"Quais ratholes estão livres?"*',
            inline: false,
          },
          {
            name: '⚡ Comandos de Barra (Slash Commands)',
            value:
              '`/rathole info <numero>` - Consulta por número\n`/rathole near <x> <y>` ou `/rathole proximo` - Busca por proximidade\n`/rathole owner <jogador>` ou `/rathole dono` - Filtra por Dono\n`/rathole responsible <jogador>` ou `/rathole responsavel` - Filtra por Responsável\n`/rathole list` ou `/rathole listar` - Lista geral',
            inline: false,
          },
          {
            name: '🌐 Idiomas Suportados',
            value: 'Suporte completo a **Inglês** (padrão preferencial), **Português**, **Francês**, **Alemão** e **Espanhol**.',
            inline: false,
          },
        ],
        footer: { text: 'TEKOli • Criado para gestão rápida em combate e teleports' },
      };

      return {
        content: `👋 Precisa de ajuda com o **TEKOli**? Aqui estão os exemplos de como me perguntar sobre qualquer rathole:`,
        embed,
        type: 'help',
        language: 'pt',
      };
    }

    if (lang === 'fr') {
      const embed: DiscordEmbed = {
        title: `🤖 TEKOli • Centre de Commandes & Infos`,
        description: `Salut ! Je suis **TEKOli**, le bot tactique du clan connecté à MongoDB. Je parle **Anglais** (préféré), **Français**, **Portugais**, **Allemand** et **Espagnol**. Pose-moi tes questions naturellement ou utilise les commandes slash :`,
        color: '#5865F2',
        fields: [
          {
            name: '❓ Questions en Langage Naturel',
            value:
              '• *"À qui appartient le rathole 3 ?"*\n• *"Ratholes proches de 14.9, 85.8"*\n• *"owner Clutch"* (filtre strictement par Owner Principal)\n• *"responsable Joey"* (filtre par Owner ou Co-Owner)\n• *"Quel est le TP du rathole 1 ?"*\n• *"Quels ratholes sont libres ?"*',
            inline: false,
          },
          {
            name: '⚡ Commandes Slash',
            value:
              '`/rathole info <numéro>` - Détails complets\n`/rathole near <x> <y>` - Recherche de proximité\n`/rathole owner <joueur>` - Filtre Owner principal\n`/rathole responsible <joueur>` - Filtre Owner + Co-Owner\n`/rathole list` - Liste des ratholes',
            inline: false,
          },
          {
            name: '🌐 Langues Supportées',
            value: '**Anglais** (par défaut), **Français**, **Portugais**, **Allemand** et **Espagnol**.',
            inline: false,
          },
        ],
        footer: { text: 'TEKOli • Conçu pour le combat rapide et les téléports' },
      };

      return {
        content: `👋 Besoin d'aide avec **TEKOli** ? Voici comment interroger nos ratholes :`,
        embed,
        type: 'help',
        language: 'fr',
      };
    }

    const embed: DiscordEmbed = {
      title: `🤖 TEKOli • Clan Bot Commands & Intel`,
      description: `Greetings! I am **TEKOli**, the tactical clan bot connected to MongoDB. You can ask me in English, French, Portuguese, German, or Spanish via natural language or slash commands:`,
      color: '#5865F2',
      fields: [
        {
          name: '❓ Natural Language Queries',
          value:
            '• *"Who owns rathole 3?"*\n• *"Nearest ratholes to 14.9, 85.8?"*\n• *"owner Clutch"* / *"welche ratholes hat @MisSy"* (strictly filters by Primary Owner)\n• *"responsible Joey"* (filters by Owner or Co-Owner)\n• *"What is the TP for rathole 1?"*\n• *"Which ratholes are free?"*',
          inline: false,
        },
        {
          name: '⚡ Slash Commands',
          value:
            '`/rathole info <number>` - Full details by number\n`/rathole near <x> <y>` - Proximity search\n`/rathole owner <name>` - Strict primary owner search\n`/rathole responsible <name>` - Owner and co-owner search\n`/rathole list` - List clan ratholes and status',
          inline: false,
        },
        {
          name: '🌐 Language Support',
          value: 'Fluent in **English** (default/preferred), **French**, **Portuguese**, **German**, and **Spanish**.',
          inline: false,
        },
      ],
      footer: { text: 'TEKOli • Built for high-speed combat and teleport queries' },
    };

    return {
      content: `👋 Need tactical intel with **TEKOli**? Here is how to query any rathole:`,
      embed,
      type: 'help',
      language: lang,
    };
  }

  // 6. List all ratholes: "list", "listar", "lister", "liste", "all", "todos"
  if (
    q.includes('listar') ||
    q.includes('lister') ||
    q.includes('liste ratholes') ||
    q.includes('todos os ratholes') ||
    q === '/rathole listar' ||
    q.includes('list ratholes') ||
    q.includes('list all') ||
    q === '/rathole list'
  ) {
    if (lang === 'pt') {
      const embed: DiscordEmbed = {
        title: `📋 Lista Geral de Ratholes do Clã (${ratholes.length})`,
        description: `Visão geral de todas as posições cadastradas no MongoDB:`,
        color: '#5865F2',
        fields: ratholes.slice(0, 8).map((rh) => ({
          name: `#${rh.numero} - ${rh.name} [${rh.status.toUpperCase()}]`,
          value: `👑 ${rh.owner} | 📍 \`(${rh.coords.x.toFixed(1)}, ${rh.coords.y.toFixed(1)})\` | ⚡ \`${rh.tp}\``,
          inline: true,
        })),
        footer: {
          text: ratholes.length > 8 ? `Exibindo 8 de ${ratholes.length} ratholes. Pergunte sobre um número específico!` : 'TEKOli Bot',
        },
      };

      return {
        content: `📋 Aqui está a relação atual de ratholes cadastrados no banco de dados:`,
        embed,
        type: 'list',
        language: 'pt',
      };
    }

    if (lang === 'fr') {
      const embed: DiscordEmbed = {
        title: `📋 Liste des Ratholes du Clan (${ratholes.length})`,
        description: `Aperçu de toutes les positions enregistrées dans MongoDB :`,
        color: '#5865F2',
        fields: ratholes.slice(0, 8).map((rh) => ({
          name: `#${rh.numero} - ${rh.name} [${rh.status.toUpperCase()}]`,
          value: `👑 ${rh.owner} | 📍 \`(${rh.coords.x.toFixed(1)}, ${rh.coords.y.toFixed(1)})\` | ⚡ \`${rh.tp}\``,
          inline: true,
        })),
        footer: {
          text: ratholes.length > 8 ? `Affichage de 8 sur ${ratholes.length} ratholes. Demande un numéro précis !` : 'TEKOli Bot',
        },
      };

      return {
        content: `📋 Voici la liste actuelle des ratholes enregistrés dans la base de données :`,
        embed,
        type: 'list',
        language: 'fr',
      };
    }

    const embed: DiscordEmbed = {
      title: `📋 Clan Ratholes Intel List (${ratholes.length})`,
      description: `Overview of all registered ratholes in MongoDB:`,
      color: '#5865F2',
      fields: ratholes.slice(0, 8).map((rh) => ({
        name: `#${rh.numero} - ${rh.name} [${rh.status.toUpperCase()}]`,
        value: `👑 ${rh.owner} | 📍 \`(${rh.coords.x.toFixed(1)}, ${rh.coords.y.toFixed(1)})\` | ⚡ \`${rh.tp}\``,
        inline: true,
      })),
      footer: {
        text: ratholes.length > 8 ? `Showing 8 of ${ratholes.length} ratholes. Query any specific number!` : 'TEKOli Bot',
      },
    };

    return {
      content: `📋 Here is the current clan ratholes database:`,
      embed,
      type: 'list',
      language: lang,
    };
  }

  // Fallback if not recognized
  if (lang === 'pt') {
    return {
      content: `🤔 Não entendi completamente a pergunta. Você pode me perguntar em inglês, português, francês ou alemão, por exemplo:\n• *"Who owns rathole 3?"* ou *"A quem pertence o rathole 3?"*\n• *"Nearest ratholes to 12, 20?"* ou *"Qual os ratholes próximo de 12,20?"*\n• *"owner Clutch"* ou *"dono Clutch"*\n• *"responsible Joey"* ou *"responsavel Joey"*\n• Digite **/ajuda** ou **/help** para ver todos os comandos.`,
      type: 'general',
      language: 'pt',
    };
  }

  if (lang === 'fr') {
    return {
      content: `🤔 Je n'ai pas tout à fait compris ta demande. Tu peux me parler en français, anglais, portugais ou allemand, par exemple :\n• *"À qui appartient le rathole 3 ?"*\n• *"Ratholes proches de 12, 20 ?"*\n• *"owner Clutch"* (filtre par Owner principal)\n• *"responsable Joey"* (Owner ou Co-Owner)\n• Tape **/help** pour voir toutes les commandes.`,
      type: 'general',
      language: 'fr',
    };
  }

  if (lang === 'de') {
    return {
      content: `🤔 Ich habe diese taktische Anfrage nicht ganz verstanden. Du kannst mich z.B. fragen:\n• *"Welche Ratholes hat @MisSy?"* (filtert nach Owner)\n• *"Wem gehört Rathole 3?"*\n• *"In der Nähe von 12, 20"*\n• *"co-owner MisSy"* oder *"responsible MisSy"*\n• Schreib **/help** für alle Befehle.`,
      type: 'general',
      language: 'de',
    };
  }

  return {
    content: `🤔 I didn't fully catch that tactical request. You can ask me in English, French, Portuguese, or German, for example:\n• *"Who owns rathole 3?"*\n• *"Nearest ratholes to 12, 20?"*\n• *"Owner Clutch"* (primary owner only)\n• *"Responsible Joey"* (owner or co-owner)\n• *"What is the TP for rathole 1?"*\n• Type **/help** for all commands.`,
    type: 'general',
    language: lang,
  };
}
