// ═══════════════════════════════════════════════════════════════
//  js/i18n.js — Dash Notes Internationalisation Module
//  Languages: English (en) · French (fr) · German (de)
//             Greek (el) · Portuguese (pt)
//  Usage:
//    import { initI18n, setLanguage, getLocale, LANG_META } from './i18n.js';
//    initI18n();                    // apply saved/default lang on load
//    setLanguage('fr');             // change language + persist
//    getLocale();                   // → 'fr-FR' (for timestamps)
//    t('goals.emptyLine1');         // dot-path lookup for JS modules
// ═══════════════════════════════════════════════════════════════

export const LANG_META = {
  en: { flag: '🇬🇧', code: 'EN', locale: 'en-GB' },
  fr: { flag: '🇫🇷', code: 'FR', locale: 'fr-FR' },
  de: { flag: '🇩🇪', code: 'DE', locale: 'de-DE' },
  el: { flag: '🇬🇷', code: 'EL', locale: 'el-GR' },
  pt: { flag: '🇵🇹', code: 'PT', locale: 'pt-PT' },
};

// ── Internal state ─────────────────────────────────────────────
let _lang = localStorage.getItem('dash-notes-lang') || 'en';

// ── Public API ─────────────────────────────────────────────────

/** Apply saved/default language on page load */
export function initI18n() {
  _applyTranslations(_lang);
}

/** Set a new language, persist it, re-apply, and dispatch event */
export function setLanguage(lang) {
  if (!translations[lang]) return;
  _lang = lang;
  localStorage.setItem('dash-notes-lang', lang);
  _applyTranslations(lang);
  window.dispatchEvent(new CustomEvent('dash-lang-changed', { detail: lang }));
}

export function getCurrentLang()  { return _lang; }
export function getLocale()       { return LANG_META[_lang]?.locale || 'en-GB'; }
export function getLangMeta()     { return LANG_META[_lang] || LANG_META.en; }

/** Dot-path key lookup for JS modules: t('goals.emptyLine1') */
export function t(key) {
  const data = translations[_lang] || translations.en;
  const val  = _getKey(data, key);
  return val !== undefined ? val : (_getKey(translations.en, key) ?? key);
}

/**
 * Renders the Q&A list for setup.html.
 * @param {string} containerId - id of the <div> to populate
 */
export function renderSetupQA(containerId = 'qa-list') {
  const container = document.getElementById(containerId);
  if (!container) return;
  const qa = t('setup.qa');
  if (!Array.isArray(qa)) return;

  container.innerHTML = qa.map((item, i) => {
    const isBestPractice = i === qa.length - 1;
    if (isBestPractice) {
      return `
        <div style="background:rgba(0,229,212,0.06); border:1px solid rgba(0,229,212,0.2);
          border-radius:var(--radius-sm); padding:14px;">
          <p style="font-size:0.85rem; font-weight:700; color:var(--cyan); margin-bottom:6px;">
            ${_esc(item.q)}
          </p>
          <p style="font-size:0.84rem; color:var(--text-secondary); line-height:1.65; margin:0;">
            ${_esc(item.a)}
          </p>
        </div>`;
    }
    return `
      <div>
        <p style="font-size:0.85rem; font-weight:700; color:var(--text-primary); margin-bottom:4px;">
          ${_esc(item.q)}
        </p>
        <p style="font-size:0.84rem; color:var(--text-secondary); line-height:1.65; margin:0;">
          ${_esc(item.a)}
        </p>
      </div>`;
  }).join('');
}

// ── Internal helpers ───────────────────────────────────────────

function _getKey(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _applyTranslations(lang) {
  const data = translations[lang] || translations.en;

  // Plain text
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const val = _getKey(data, el.getAttribute('data-i18n'));
    if (val !== undefined) el.textContent = val;
  });

  // HTML content
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const val = _getKey(data, el.getAttribute('data-i18n-html'));
    if (val !== undefined) el.innerHTML = val;
  });

  // Placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const val = _getKey(data, el.getAttribute('data-i18n-placeholder'));
    if (val !== undefined) el.placeholder = val;
  });

  document.documentElement.lang = lang;

  // Re-render Q&A if on setup page
  renderSetupQA('qa-list');
}


// ═══════════════════════════════════════════════════════════════
//  TRANSLATIONS
// ═══════════════════════════════════════════════════════════════
const translations = {

  // ── ENGLISH ───────────────────────────────────────────────────
  en: {
    nav: {
      takeNote:  '<span style="display:block;">Take</span><span style="display:block;">Note</span>',
      startHere: '<span style="display:block;">Start</span><span style="display:block;">Here</span>',
    },
    panel: {
      title:       'About Dash Notes',
      tagline:     'A private thinking space for fast minds.',
      desc:        'Built around the 3C Goal Setting Framework and the Eisenhower Decision Matrix — this app helps you set meaningful goals, sort priorities, and capture thoughts before they disappear.',
      worksFor:    'Works best for people who',
      worksForList:'Think faster than they can organise · Want goals that reflect real values · Need to capture ideas on the move · Prefer clarity over noise',
      privacyTitle:'Privacy',
      privacyText: 'No server. No account. No data leaves your device. Everything is stored privately in your browser. Use the Save section to back up your data regularly.',
    },
    goals: {
      title:          'Goals',
      subtitle:       'Start with your <em>why</em> — not your to-do list.',
      addBtn:         '+ Add Goal',
      tipCard:        '<strong style="color:var(--text-secondary);">3C Tip:</strong> Choose 2 goals that feel big and exciting, 2 that feel easy and fun, and 1 that feels deep and meaningful. Progress beats perfection every time.',
      emptyLine1:     'No goals yet. Add your first goal below.',
      emptyLine2:     'Start with your "why" — not your "what."',
      editBtn:        'Edit',
      progress:       'Progress',
      addedOn:        'Added',
      maxReached:     'Maximum 5 goals. Complete or remove one first.',
      modalAdd:       'Add New Goal',
      modalEdit:      'Edit Goal',
      labelTitle:     'Goal Title *',
      labelWhy:       'Why does this matter to you?',
      labelMilestones:'3 Milestones (one per line)',
      labelReflection:'Weekly Reflection',
      phTitle:        'e.g. Launch my 3C project',
      phWhy:          'The deeper reason — not the task, the feeling...',
      phMilestones:   'Step 1\nStep 2\nStep 3',
      phReflection:   'What moved you forward this week?',
      btnSave:        'Save Goal',
      btnUpdate:      'Update Goal',
      toastRemoved:   'Goal removed',
      toastSaved:     'Goal saved ✅',
      toastUpdated:   'Goal updated ✅',
      toastNoTitle:   'Please add a goal title',
      confirmDelete:  'Delete this goal?',
    },
    matrix: {
      title:           'Eisenhower Matrix',
      subtitle:        'Decide before you react. Drag tasks between quadrants.',
      placeholder:     'Add a task or decision…',
      addBtn:          'Add',
      q1:              'Do First',
      q2:              'Schedule',
      q3:              'Delegate',
      q4:              'Drop',
      axisUrgent:      'Urgent',
      axisImportant:   '← Important',
      axisNotImportant:'Not Important →',
      tipCard:         '<strong style="color:var(--text-secondary);">Eisenhower Method:</strong> Urgent is loud. Important is quiet. The method works when Schedule becomes non-negotiable — not optional.',
    },
    voice: {
      title:                'Voice Notes',
      subtitle:             'Capture a thought before it disappears — transcribed to text automatically.',
      status:               'Ready to record. Tap the mic to start.',
      transcriptPlaceholder:'Your spoken words will appear here as you record…',
      browserNote:          '🎙️ Voice transcription works best in <strong style="color:var(--text-secondary);">Chrome or Edge</strong>. Firefox and Safari have limited support. The audio itself is never stored — only the text.',
      savedTitle:           'Saved Voice Notes',
      emptyState:           'No voice notes yet. Record your first thought.',
      micDenied:            'Microphone access denied — check browser permissions.',
      noSpeech:             'No speech detected. Try again or check microphone.',
      noteSaved:            'Voice note saved ✅',
      notSupported:         '⚠️ Voice transcription works best in Chrome or Edge.',
      noSpeechApi:          'Voice-to-text not available in this browser — recording timer only.',
      copied:               'Copied to clipboard ✅',
    },
    notes: {
      title:              'Notes',
      tabNote:            'Note',
      tabQuote:           'Quote',
      tabWishlist:        'Wish List',
      subjectPlaceholder: 'Subject or reference (optional)',
      padPlaceholder:     "What's on your mind? Just start typing…",
      saveBtn:            'Save',
      shortcut:           'or Ctrl + Enter',
      savedTitle:         'Saved',
      emptyState:         'Nothing saved yet in this section.',
      phQuote:            'A thought, a quote, something worth keeping…',
      phWishlist:         'Something you want, need, or are working towards…',
      editLoaded:         'Edit loaded — make changes and tap Update',
      toastUpdated:       'Updated ✅',
      toastSaved:         'Saved ✅',
      updateBtn:          'Update',
      storeBtn:           '↗ Store',
      copied:             'Copied to clipboard ✅',
    },
    camera: {
      title:            'Camera Capture',
      subtitle:         'Photograph a handwritten note, whiteboard, or anything you want to remember. The image stays on your device only.',
      zoneLabel:        'Tap to take a photo or choose an image from your library',
      noImage:          'No image captured yet. Tap the camera area above.',
      tip:              '💡 After capturing, tap <strong style="color:var(--text-secondary);">"Share / Save to your notes app"</strong> to send the image directly to Apple Notes, Google Keep, or any app on your device.',
      shareBtn:         'Share / Save to your notes app',
      clearBtn:         'Clear',
      deviceOnly:       'image stays on your device only',
      noImageCleared:   'No image captured. Tap the camera area above.',
      toastNotImage:    'Please select an image file.',
      toastShareFailed: 'Sharing not supported — save the image manually.',
      toastShareBrowser:'Use your browser to save or share this image.',
    },
    backup: {
      title:              'Save & Restore',
      subtitle:           'Keep your thoughts safe. Share them to your favourite app or save a backup file.',
      storeTitle:         'Store Your Notes',
      storeDesc:          "Send your goals and notes to any app on your device — your notes app, a message to yourself, or anywhere you keep things safe. One tap opens your device's own share menu.",
      storeBtn:           'Share My Notes',
      downloadTitle:      '💾 Download Backup File',
      downloadDesc:       'Downloads a complete copy of your data to your device. Store it anywhere — your phone, computer, or cloud storage.',
      downloadBtn:        'Download Backup',
      restoreTitle:       '🔁 Restore from Backup',
      restoreDesc:        'Previously downloaded a backup file? Tap below to restore your data.',
      restoreBtn:         'Choose Backup File',
      bestPracticeTitle:  'Best Practice',
      bestPracticeText:   'For notes you want to keep long term, download a backup regularly and keep updating that same note over time. The JSON file becomes your running plan — always recoverable. Use Store for shorter notes that get acted on and discarded. Both work together.',
      privacyNote:        '🔒 <strong style="color:var(--text-secondary);">Important:</strong> Clearing your browser\'s site data will permanently delete your Dash Notes data. Always share or download a backup first. <strong style="color:var(--cyan);">Your data. Your responsibility. Your freedom.</strong>',
      toastCopied:        'Copied — paste into your notes app ✅',
      toastShareFailed:   'Could not share — try downloading instead.',
      toastDownloaded:    'Backup downloaded ✅',
      toastDownloadFailed:'Download failed — try again.',
      toastBadFile:       'File not recognised — use a Dash Notes backup.',
      toastRestored:      'Data restored ✅',
      toastRestoreFailed: 'Restore failed — file may be damaged.',
    },
    tabs: {
      goals:  'Goals',
      matrix: 'Matrix',
      voice:  'Voice',
      notes:  'Notes',
      camera: 'Camera',
      backup: 'Save',
    },
    setup: {
      title:      'Start Here',
      subtitle:   "There's not much to configure — the app is designed to just work.",
      storeTitle: 'Storing Your Notes',
      storeText:  'When you tap <strong style="color:var(--text-primary);">Store My Notes</strong> in the Save section, your device opens its own share menu — the same one you use everywhere else on your phone. Choose wherever you normally keep things: your notes app, a message to yourself, cloud storage, or anything else that appears. No setup needed.',
      safeTitle:  'Keeping Your Data Safe',
      safeText:   'Your notes live on this device only. If you clear your browser storage, they\'re gone. Use <strong style="color:var(--text-primary);">Save → Share</strong> or <strong style="color:var(--text-primary);">Save → Download Backup</strong> regularly. That\'s all you need to do.',
      voiceTitle: 'Voice Notes',
      voiceText:  'Voice transcription works best in Chrome or Edge on Android. On iPhone, use Safari. The recording is never stored — only the text that comes from it.',
      qaBtn:      'Q & A',
      qaTitle:    'Questions & Answers',
      closeBtn:   'Close',
      leaveBtn:   'Leave',
      qa: [
        { q: 'Where is my data stored?',
          a: 'Everything stays on your device in your browser\'s local storage. Nothing is sent to any server. No one else can see it — including the people who made this app.' },
        { q: 'What happens if I clear my browser data?',
          a: 'Your notes will be deleted permanently. This is why backing up regularly matters. Use the Save section to share or download your data before clearing anything.' },
        { q: 'How do I save my notes across sections?',
          a: 'Each section saves automatically as you add content — goals, tasks, notes and voice recordings are all stored independently. You do not need to save a session. Just add and move on.' },
        { q: 'How do I get this app on my phone home screen?',
          a: 'On Android, open the app in Chrome, tap the three dots menu and select Add to Home Screen. On iPhone, open the app in Safari, tap the Share button and select Add to Home Screen. The app will then open like any other app on your phone.' },
        { q: 'Does it work without internet?',
          a: 'Yes — once you have opened the app once, it works fully offline. All your data is on your device, so no connection is needed.' },
        { q: 'How does voice recording work?',
          a: 'Tap the mic button in the Voice section, speak your thought, and tap again to stop. Your browser transcribes the speech into text automatically. The audio itself is never stored — only the words.' },
        { q: 'Which browser works best?',
          a: 'Chrome or Edge on Android gives the best voice transcription. On iPhone, use Safari. All other features work across all modern browsers.' },
        { q: 'How do I restore from a backup?',
          a: 'Go to the Save section, tap Choose Backup File, and select the backup file you downloaded previously. Your data will be restored alongside anything already saved.' },
        { q: 'Best Practice — Keeping Your Notes Long Term',
          a: 'For notes you want to keep long term — shopping lists, ongoing goals, plans that evolve — use Download Backup regularly and keep updating that same file. The JSON becomes your running plan. For shorter notes that get acted on and discarded, use Store. Both work together.' },
      ],
    },
  },


  // ── FRENCH ────────────────────────────────────────────────────
  fr: {
    nav: {
      takeNote:  '<span style="display:block;">Prendre</span><span style="display:block;">Note</span>',
      startHere: '<span style="display:block;">Par</span><span style="display:block;">Ici</span>',
    },
    panel: {
      title:       'À propos de Dash Notes',
      tagline:     'Un espace de réflexion privé pour les esprits rapides.',
      desc:        'Basé sur le cadre 3C et la Matrice d\'Eisenhower — cette application vous aide à définir des objectifs, trier vos priorités et capturer vos pensées.',
      worksFor:    'Idéal pour les personnes qui',
      worksForList:'Pensent plus vite qu\'elles ne s\'organisent · Veulent des objectifs reflétant leurs vraies valeurs · Ont besoin de capturer des idées en déplacement · Préfèrent la clarté au bruit',
      privacyTitle:'Confidentialité',
      privacyText: 'Aucun serveur. Aucun compte. Aucune donnée ne quitte votre appareil. Tout est stocké en privé dans votre navigateur. Utilisez la section Sauvegarder régulièrement.',
    },
    goals: {
      title:          'Objectifs',
      subtitle:       'Commencez par votre <em>pourquoi</em> — pas votre liste de tâches.',
      addBtn:         '+ Ajouter un objectif',
      tipCard:        '<strong style="color:var(--text-secondary);">Conseil 3C :</strong> Choisissez 2 objectifs ambitieux et motivants, 2 faciles et agréables, et 1 profond et significatif. Le progrès vaut mieux que la perfection.',
      emptyLine1:     'Aucun objectif pour l\'instant. Ajoutez votre premier objectif ci-dessous.',
      emptyLine2:     'Commencez par votre « pourquoi » — pas votre « quoi ».',
      editBtn:        'Modifier',
      progress:       'Progrès',
      addedOn:        'Ajouté le',
      maxReached:     'Maximum 5 objectifs. Terminez-en ou supprimez-en un d\'abord.',
      modalAdd:       'Ajouter un objectif',
      modalEdit:      'Modifier l\'objectif',
      labelTitle:     'Titre de l\'objectif *',
      labelWhy:       'Pourquoi est-ce important pour vous ?',
      labelMilestones:'3 jalons (un par ligne)',
      labelReflection:'Réflexion hebdomadaire',
      phTitle:        'ex. Lancer mon projet 3C',
      phWhy:          'La raison profonde — pas la tâche, le ressenti...',
      phMilestones:   'Étape 1\nÉtape 2\nÉtape 3',
      phReflection:   'Qu\'est-ce qui vous a fait avancer cette semaine ?',
      btnSave:        'Enregistrer l\'objectif',
      btnUpdate:      'Mettre à jour l\'objectif',
      toastRemoved:   'Objectif supprimé',
      toastSaved:     'Objectif enregistré ✅',
      toastUpdated:   'Objectif mis à jour ✅',
      toastNoTitle:   'Veuillez ajouter un titre d\'objectif',
      confirmDelete:  'Supprimer cet objectif ?',
    },
    matrix: {
      title:           'Matrice d\'Eisenhower',
      subtitle:        'Décidez avant de réagir. Faites glisser les tâches entre les quadrants.',
      placeholder:     'Ajouter une tâche ou une décision…',
      addBtn:          'Ajouter',
      q1:              'À faire d\'abord',
      q2:              'Planifier',
      q3:              'Déléguer',
      q4:              'Abandonner',
      axisUrgent:      'Urgent',
      axisImportant:   '← Important',
      axisNotImportant:'Pas important →',
      tipCard:         '<strong style="color:var(--text-secondary);">Méthode Eisenhower :</strong> L\'urgent est bruyant. L\'important est silencieux. La méthode fonctionne quand Planifier devient non négociable — pas optionnel.',
    },
    voice: {
      title:                'Notes vocales',
      subtitle:             'Capturez une pensée avant qu\'elle disparaisse — transcrite automatiquement en texte.',
      status:               'Prêt à enregistrer. Appuyez sur le micro pour commencer.',
      transcriptPlaceholder:'Vos mots apparaîtront ici au fur et à mesure…',
      browserNote:          '🎙️ La transcription vocale fonctionne mieux dans <strong style="color:var(--text-secondary);">Chrome ou Edge</strong>. Firefox et Safari ont un support limité. L\'audio n\'est jamais stocké — seulement le texte.',
      savedTitle:           'Notes vocales enregistrées',
      emptyState:           'Aucune note vocale. Enregistrez votre première pensée.',
      micDenied:            'Accès au micro refusé — vérifiez les permissions du navigateur.',
      noSpeech:             'Aucun discours détecté. Réessayez ou vérifiez le micro.',
      noteSaved:            'Note vocale enregistrée ✅',
      notSupported:         '⚠️ La transcription vocale fonctionne mieux dans Chrome ou Edge.',
      noSpeechApi:          'Synthèse vocale non disponible dans ce navigateur — minuterie seulement.',
      copied:               'Copié dans le presse-papiers ✅',
    },
    notes: {
      title:              'Notes',
      tabNote:            'Note',
      tabQuote:           'Citation',
      tabWishlist:        'Liste de souhaits',
      subjectPlaceholder: 'Sujet ou référence (optionnel)',
      padPlaceholder:     'Qu\'avez-vous en tête ? Commencez à taper…',
      saveBtn:            'Enregistrer',
      shortcut:           'ou Ctrl + Entrée',
      savedTitle:         'Enregistré',
      emptyState:         'Rien d\'enregistré dans cette section.',
      phQuote:            'Une pensée, une citation, quelque chose qui mérite d\'être gardé…',
      phWishlist:         'Quelque chose que vous voulez, dont vous avez besoin ou vers quoi vous travaillez…',
      editLoaded:         'Modification chargée — apportez des changements et appuyez sur Mettre à jour',
      toastUpdated:       'Mis à jour ✅',
      toastSaved:         'Enregistré ✅',
      updateBtn:          'Mettre à jour',
      storeBtn:           '↗ Stocker',
      copied:             'Copié dans le presse-papiers ✅',
    },
    camera: {
      title:            'Capture photo',
      subtitle:         'Photographiez une note manuscrite, un tableau blanc ou tout ce que vous souhaitez mémoriser. L\'image reste uniquement sur votre appareil.',
      zoneLabel:        'Appuyez pour prendre une photo ou choisir une image',
      noImage:          'Aucune image capturée. Appuyez sur la zone caméra ci-dessus.',
      tip:              '💡 Après la capture, appuyez sur <strong style="color:var(--text-secondary);">"Partager / Enregistrer dans vos notes"</strong> pour envoyer l\'image vers Apple Notes, Google Keep ou toute autre application.',
      shareBtn:         'Partager / Enregistrer dans vos notes',
      clearBtn:         'Effacer',
      deviceOnly:       'image uniquement sur votre appareil',
      noImageCleared:   'Aucune image capturée. Appuyez sur la zone caméra ci-dessus.',
      toastNotImage:    'Veuillez sélectionner un fichier image.',
      toastShareFailed: 'Partage non pris en charge — enregistrez l\'image manuellement.',
      toastShareBrowser:'Utilisez votre navigateur pour enregistrer ou partager cette image.',
    },
    backup: {
      title:              'Sauvegarder et restaurer',
      subtitle:           'Gardez vos pensées en sécurité. Partagez-les ou sauvegardez une copie.',
      storeTitle:         'Stocker vos notes',
      storeDesc:          'Envoyez vos objectifs et notes vers n\'importe quelle application — votre app de notes, un message à vous-même, ou n\'importe où. Un appui ouvre le menu de partage de votre appareil.',
      storeBtn:           'Partager mes notes',
      downloadTitle:      '💾 Télécharger la sauvegarde',
      downloadDesc:       'Télécharge une copie complète de vos données. Stockez-la n\'importe où — téléphone, ordinateur ou cloud.',
      downloadBtn:        'Télécharger',
      restoreTitle:       '🔁 Restaurer depuis une sauvegarde',
      restoreDesc:        'Vous avez téléchargé un fichier de sauvegarde ? Appuyez ci-dessous pour restaurer vos données.',
      restoreBtn:         'Choisir le fichier',
      bestPracticeTitle:  'Bonne pratique',
      bestPracticeText:   'Pour les notes à long terme, téléchargez régulièrement une sauvegarde en mettant à jour le même fichier. Le JSON devient votre plan évolutif — toujours récupérable. Utilisez Partager pour les notes courtes. Les deux fonctionnent ensemble.',
      privacyNote:        '🔒 <strong style="color:var(--text-secondary);">Important :</strong> Vider les données du navigateur supprimera définitivement vos données Dash Notes. Partagez ou téléchargez une sauvegarde d\'abord. <strong style="color:var(--cyan);">Vos données. Votre responsabilité. Votre liberté.</strong>',
      toastCopied:        'Copié — collez dans votre app de notes ✅',
      toastShareFailed:   'Impossible de partager — essayez de télécharger.',
      toastDownloaded:    'Sauvegarde téléchargée ✅',
      toastDownloadFailed:'Téléchargement échoué — réessayez.',
      toastBadFile:       'Fichier non reconnu — utilisez une sauvegarde Dash Notes.',
      toastRestored:      'Données restaurées ✅',
      toastRestoreFailed: 'Restauration échouée — le fichier est peut-être endommagé.',
    },
    tabs: {
      goals:  'Buts',
      matrix: 'Matrice',
      voice:  'Vocal',
      notes:  'Notes',
      camera: 'Caméra',
      backup: 'Sauv.',
    },
    setup: {
      title:      'Commencer',
      subtitle:   'Il n\'y a pas grand-chose à configurer — l\'application est conçue pour fonctionner directement.',
      storeTitle: 'Stocker vos notes',
      storeText:  'Lorsque vous appuyez sur <strong style="color:var(--text-primary);">Partager mes notes</strong> dans la section Sauvegarder, votre appareil ouvre son propre menu de partage — le même que vous utilisez partout. Choisissez où vous gardez habituellement vos affaires. Aucune configuration nécessaire.',
      safeTitle:  'Garder vos données en sécurité',
      safeText:   'Vos notes vivent uniquement sur cet appareil. Si vous videz le stockage du navigateur, elles sont perdues. Utilisez <strong style="color:var(--text-primary);">Sauv. → Partager</strong> ou <strong style="color:var(--text-primary);">Sauv. → Télécharger</strong> régulièrement. C\'est tout ce que vous devez faire.',
      voiceTitle: 'Notes vocales',
      voiceText:  'La transcription vocale fonctionne mieux dans Chrome ou Edge sur Android. Sur iPhone, utilisez Safari. L\'enregistrement n\'est jamais stocké — seulement le texte.',
      qaBtn:      'Q & R',
      qaTitle:    'Questions et réponses',
      closeBtn:   'Fermer',
      leaveBtn:   'Quitter',
      qa: [
        { q: 'Où sont stockées mes données ?',
          a: 'Tout reste sur votre appareil dans le stockage local du navigateur. Rien n\'est envoyé à un serveur. Personne d\'autre ne peut le voir — y compris les créateurs de cette application.' },
        { q: 'Que se passe-t-il si je vide mes données de navigation ?',
          a: 'Vos notes seront supprimées définitivement. C\'est pourquoi il est important de sauvegarder régulièrement. Utilisez la section Sauvegarder avant de vider quoi que ce soit.' },
        { q: 'Comment mes notes sont-elles sauvegardées entre les sections ?',
          a: 'Chaque section sauvegarde automatiquement au fur et à mesure — objectifs, tâches, notes et enregistrements vocaux sont stockés indépendamment. Vous n\'avez pas besoin de sauvegarder une session.' },
        { q: 'Comment ajouter l\'application à l\'écran d\'accueil ?',
          a: 'Sur Android : ouvrez dans Chrome, appuyez sur les trois points et sélectionnez Ajouter à l\'écran d\'accueil. Sur iPhone : ouvrez dans Safari, appuyez sur Partager puis Ajouter à l\'écran d\'accueil.' },
        { q: 'Fonctionne-t-elle sans internet ?',
          a: 'Oui — une fois ouverte une première fois, l\'application fonctionne entièrement hors ligne. Toutes vos données sont sur votre appareil.' },
        { q: 'Comment fonctionne l\'enregistrement vocal ?',
          a: 'Appuyez sur le bouton micro dans la section Vocal, parlez, et appuyez à nouveau pour arrêter. Le navigateur transcrit automatiquement. L\'audio n\'est jamais stocké — seulement les mots.' },
        { q: 'Quel navigateur fonctionne le mieux ?',
          a: 'Chrome ou Edge sur Android pour la meilleure transcription vocale. Sur iPhone, utilisez Safari. Toutes les autres fonctions fonctionnent sur tous les navigateurs modernes.' },
        { q: 'Comment restaurer depuis une sauvegarde ?',
          a: 'Allez dans la section Sauvegarder, appuyez sur Choisir le fichier et sélectionnez le fichier téléchargé. Vos données seront restaurées en complément de ce qui est déjà enregistré.' },
        { q: 'Bonne pratique — Garder vos notes à long terme',
          a: 'Pour les notes à long terme — listes, objectifs évolutifs, plans — téléchargez régulièrement une sauvegarde en mettant à jour ce même fichier. Pour les notes courtes, utilisez Partager. Les deux fonctionnent ensemble.' },
      ],
    },
  },


  // ── GERMAN ────────────────────────────────────────────────────
  de: {
    nav: {
      takeNote:  '<span style="display:block;">Notiz</span><span style="display:block;">Machen</span>',
      startHere: '<span style="display:block;">Hier</span><span style="display:block;">Starten</span>',
    },
    panel: {
      title:       'Über Dash Notes',
      tagline:     'Ein privater Denkraum für schnelle Köpfe.',
      desc:        'Basierend auf dem 3C-Zielsetzungsrahmen und der Eisenhower-Matrix — diese App hilft dir, sinnvolle Ziele zu setzen, Prioritäten zu ordnen und Gedanken festzuhalten.',
      worksFor:    'Am besten für Personen, die',
      worksForList:'Schneller denken als sie organisieren · Ziele wollen, die echte Werte widerspiegeln · Ideen unterwegs festhalten müssen · Klarheit über Lärm bevorzugen',
      privacyTitle:'Datenschutz',
      privacyText: 'Kein Server. Kein Konto. Keine Daten verlassen dein Gerät. Alles wird privat in deinem Browser gespeichert. Nutze die Speichern-Sektion für regelmäßige Backups.',
    },
    goals: {
      title:          'Ziele',
      subtitle:       'Beginne mit deinem <em>Warum</em> — nicht deiner To-do-Liste.',
      addBtn:         '+ Ziel hinzufügen',
      tipCard:        '<strong style="color:var(--text-secondary);">3C-Tipp:</strong> Wähle 2 Ziele, die sich groß und aufregend anfühlen, 2 die leicht und Spaß machen, und 1, das tief und bedeutsam ist. Fortschritt schlägt Perfektion.',
      emptyLine1:     'Noch keine Ziele. Füge dein erstes Ziel unten hinzu.',
      emptyLine2:     'Beginne mit deinem „Warum" — nicht deinem „Was".',
      editBtn:        'Bearbeiten',
      progress:       'Fortschritt',
      addedOn:        'Hinzugefügt am',
      maxReached:     'Maximum 5 Ziele. Schließe oder entferne zuerst eines.',
      modalAdd:       'Neues Ziel hinzufügen',
      modalEdit:      'Ziel bearbeiten',
      labelTitle:     'Ziel-Titel *',
      labelWhy:       'Warum ist das wichtig für dich?',
      labelMilestones:'3 Meilensteine (einer pro Zeile)',
      labelReflection:'Wöchentliche Reflexion',
      phTitle:        'z.B. Mein 3C-Projekt starten',
      phWhy:          'Der tiefere Grund — nicht die Aufgabe, das Gefühl...',
      phMilestones:   'Schritt 1\nSchritt 2\nSchritt 3',
      phReflection:   'Was hat dich diese Woche vorangebracht?',
      btnSave:        'Ziel speichern',
      btnUpdate:      'Ziel aktualisieren',
      toastRemoved:   'Ziel entfernt',
      toastSaved:     'Ziel gespeichert ✅',
      toastUpdated:   'Ziel aktualisiert ✅',
      toastNoTitle:   'Bitte einen Ziel-Titel hinzufügen',
      confirmDelete:  'Dieses Ziel löschen?',
    },
    matrix: {
      title:           'Eisenhower-Matrix',
      subtitle:        'Entscheide, bevor du reagierst. Aufgaben zwischen Quadranten verschieben.',
      placeholder:     'Aufgabe oder Entscheidung hinzufügen…',
      addBtn:          'Hinzufügen',
      q1:              'Zuerst erledigen',
      q2:              'Planen',
      q3:              'Delegieren',
      q4:              'Verwerfen',
      axisUrgent:      'Dringend',
      axisImportant:   '← Wichtig',
      axisNotImportant:'Nicht wichtig →',
      tipCard:         '<strong style="color:var(--text-secondary);">Eisenhower-Methode:</strong> Dringendes ist laut. Wichtiges ist leise. Die Methode funktioniert, wenn Planen zur Pflicht wird — nicht zur Option.',
    },
    voice: {
      title:                'Sprachnotizen',
      subtitle:             'Halte einen Gedanken fest, bevor er verschwindet — automatisch in Text umgewandelt.',
      status:               'Bereit zur Aufnahme. Tippe auf das Mikrofon.',
      transcriptPlaceholder:'Deine Worte erscheinen hier während der Aufnahme…',
      browserNote:          '🎙️ Sprachtranskription funktioniert am besten in <strong style="color:var(--text-secondary);">Chrome oder Edge</strong>. Firefox und Safari haben eingeschränkte Unterstützung. Das Audio wird nie gespeichert — nur der Text.',
      savedTitle:           'Gespeicherte Sprachnotizen',
      emptyState:           'Noch keine Sprachnotizen. Nimm deinen ersten Gedanken auf.',
      micDenied:            'Mikrofonzugriff verweigert — prüfe die Browser-Berechtigungen.',
      noSpeech:             'Keine Sprache erkannt. Versuche es erneut oder prüfe das Mikrofon.',
      noteSaved:            'Sprachnotiz gespeichert ✅',
      notSupported:         '⚠️ Sprachtranskription funktioniert am besten in Chrome oder Edge.',
      noSpeechApi:          'Spracherfassung in diesem Browser nicht verfügbar — nur Timer.',
      copied:               'In Zwischenablage kopiert ✅',
    },
    notes: {
      title:              'Notizen',
      tabNote:            'Notiz',
      tabQuote:           'Zitat',
      tabWishlist:        'Wunschliste',
      subjectPlaceholder: 'Betreff oder Referenz (optional)',
      padPlaceholder:     'Was beschäftigt dich? Einfach tippen…',
      saveBtn:            'Speichern',
      shortcut:           'oder Strg + Enter',
      savedTitle:         'Gespeichert',
      emptyState:         'Noch nichts in diesem Bereich gespeichert.',
      phQuote:            'Ein Gedanke, ein Zitat, etwas das erhalten werden sollte…',
      phWishlist:         'Etwas das du willst, brauchst oder anstrebst…',
      editLoaded:         'Bearbeitung geladen — Änderungen vornehmen und Aktualisieren tippen',
      toastUpdated:       'Aktualisiert ✅',
      toastSaved:         'Gespeichert ✅',
      updateBtn:          'Aktualisieren',
      storeBtn:           '↗ Speichern',
      copied:             'In Zwischenablage kopiert ✅',
    },
    camera: {
      title:            'Kameraaufnahme',
      subtitle:         'Fotografiere eine handgeschriebene Notiz, ein Whiteboard oder alles, was du festhalten möchtest. Das Bild bleibt nur auf deinem Gerät.',
      zoneLabel:        'Tippe, um ein Foto aufzunehmen oder ein Bild auszuwählen',
      noImage:          'Noch kein Bild aufgenommen. Tippe oben auf die Kamerazone.',
      tip:              '💡 Nach der Aufnahme tippe auf <strong style="color:var(--text-secondary);">"Teilen / In Notiz-App speichern"</strong>, um das Bild an Apple Notes, Google Keep oder eine andere App zu senden.',
      shareBtn:         'Teilen / In Notiz-App speichern',
      clearBtn:         'Löschen',
      deviceOnly:       'Bild bleibt nur auf deinem Gerät',
      noImageCleared:   'Kein Bild aufgenommen. Tippe oben auf die Kamerazone.',
      toastNotImage:    'Bitte eine Bilddatei auswählen.',
      toastShareFailed: 'Teilen nicht unterstützt — Bild manuell speichern.',
      toastShareBrowser:'Nutze deinen Browser zum Speichern oder Teilen dieses Bildes.',
    },
    backup: {
      title:              'Speichern & Wiederherstellen',
      subtitle:           'Halte deine Gedanken sicher. Teile sie oder speichere eine Sicherungsdatei.',
      storeTitle:         'Notizen speichern',
      storeDesc:          'Sende deine Ziele und Notizen an jede App auf deinem Gerät — deine Notiz-App, eine Nachricht an dich selbst oder überall. Ein Tippen öffnet das Teilen-Menü deines Geräts.',
      storeBtn:           'Notizen teilen',
      downloadTitle:      '💾 Sicherung herunterladen',
      downloadDesc:       'Lädt eine vollständige Kopie deiner Daten herunter. Speichere sie überall — Telefon, Computer oder Cloud-Speicher.',
      downloadBtn:        'Herunterladen',
      restoreTitle:       '🔁 Aus Sicherung wiederherstellen',
      restoreDesc:        'Hast du eine Sicherungsdatei heruntergeladen? Tippe unten, um deine Daten wiederherzustellen.',
      restoreBtn:         'Sicherungsdatei wählen',
      bestPracticeTitle:  'Beste Praxis',
      bestPracticeText:   'Für langfristige Notizen lade regelmäßig eine Sicherung herunter und aktualisiere dieselbe Datei. Die JSON-Datei wird dein laufender Plan — immer wiederherstellbar. Nutze Teilen für kürzere Notizen. Beide ergänzen sich.',
      privacyNote:        '🔒 <strong style="color:var(--text-secondary);">Wichtig:</strong> Das Löschen der Browserdaten löscht deine Dash Notes dauerhaft. Teile oder lade immer zuerst eine Sicherung herunter. <strong style="color:var(--cyan);">Deine Daten. Deine Verantwortung. Deine Freiheit.</strong>',
      toastCopied:        'Kopiert — in deine Notiz-App einfügen ✅',
      toastShareFailed:   'Teilen fehlgeschlagen — versuche herunterzuladen.',
      toastDownloaded:    'Sicherung heruntergeladen ✅',
      toastDownloadFailed:'Download fehlgeschlagen — versuche es erneut.',
      toastBadFile:       'Datei nicht erkannt — nutze eine Dash Notes Sicherung.',
      toastRestored:      'Daten wiederhergestellt ✅',
      toastRestoreFailed: 'Wiederherstellung fehlgeschlagen — Datei könnte beschädigt sein.',
    },
    tabs: {
      goals:  'Ziele',
      matrix: 'Matrix',
      voice:  'Sprache',
      notes:  'Notizen',
      camera: 'Kamera',
      backup: 'Speich.',
    },
    setup: {
      title:      'Hier starten',
      subtitle:   'Es gibt nicht viel zu konfigurieren — die App ist so konzipiert, dass sie einfach funktioniert.',
      storeTitle: 'Notizen speichern',
      storeText:  'Wenn du im Speichern-Bereich auf <strong style="color:var(--text-primary);">Notizen teilen</strong> tippst, öffnet dein Gerät sein eigenes Teilen-Menü — dasselbe, das du überall verwendest. Wähle, wo du normalerweise Dinge aufbewahrst. Keine Einrichtung erforderlich.',
      safeTitle:  'Deine Daten sicher halten',
      safeText:   'Deine Notizen leben nur auf diesem Gerät. Wenn du den Browser-Speicher leerst, sind sie weg. Nutze <strong style="color:var(--text-primary);">Speich. → Teilen</strong> oder <strong style="color:var(--text-primary);">Speich. → Herunterladen</strong> regelmäßig. Das ist alles, was du tun musst.',
      voiceTitle: 'Sprachnotizen',
      voiceText:  'Sprachtranskription funktioniert am besten in Chrome oder Edge auf Android. Auf dem iPhone verwende Safari. Die Aufnahme wird nie gespeichert — nur der Text.',
      qaBtn:      'F & A',
      qaTitle:    'Fragen & Antworten',
      closeBtn:   'Schließen',
      leaveBtn:   'Verlassen',
      qa: [
        { q: 'Wo werden meine Daten gespeichert?',
          a: 'Alles bleibt auf deinem Gerät im lokalen Speicher des Browsers. Nichts wird an einen Server gesendet. Niemand sonst kann es sehen — auch nicht die Entwickler dieser App.' },
        { q: 'Was passiert, wenn ich meine Browser-Daten lösche?',
          a: 'Deine Notizen werden dauerhaft gelöscht. Deshalb ist regelmäßiges Sichern wichtig. Nutze die Speichern-Sektion, bevor du etwas löschst.' },
        { q: 'Wie werden meine Notizen abschnittsübergreifend gespeichert?',
          a: 'Jede Sektion speichert automatisch — Ziele, Aufgaben, Notizen und Sprachaufnahmen werden unabhängig gespeichert. Du musst keine Sitzung speichern.' },
        { q: 'Wie bekomme ich die App auf meinen Startbildschirm?',
          a: 'Auf Android: Chrome öffnen, drei Punkte tippen, „Zum Startbildschirm hinzufügen". Auf iPhone: Safari öffnen, Teilen-Symbol tippen, „Zum Home-Bildschirm hinzufügen".' },
        { q: 'Funktioniert sie ohne Internet?',
          a: 'Ja — nach dem ersten Öffnen funktioniert die App vollständig offline. Alle Daten sind auf deinem Gerät.' },
        { q: 'Wie funktioniert die Sprachaufnahme?',
          a: 'Tippe auf den Mikrofon-Button im Sprach-Bereich, sprich, und tippe erneut zum Stoppen. Der Browser transkribiert automatisch. Das Audio wird nie gespeichert — nur die Worte.' },
        { q: 'Welcher Browser funktioniert am besten?',
          a: 'Chrome oder Edge auf Android für die beste Sprachtranskription. Auf iPhone Safari nutzen. Alle anderen Funktionen arbeiten in allen modernen Browsern.' },
        { q: 'Wie stelle ich eine Sicherung wieder her?',
          a: 'Gehe zum Speichern-Bereich, tippe auf Sicherungsdatei wählen und wähle die heruntergeladene Datei. Deine Daten werden neben dem bereits Gespeicherten wiederhergestellt.' },
        { q: 'Beste Praxis — Langfristige Notizen aufbewahren',
          a: 'Für langfristige Notizen lade regelmäßig eine Sicherung herunter und aktualisiere dieselbe Datei. Für kürzere Notizen nutze Teilen. Beide ergänzen sich perfekt.' },
      ],
    },
  },


  // ── GREEK ─────────────────────────────────────────────────────
  el: {
    nav: {
      takeNote:  '<span style="display:block;">Σημεί-</span><span style="display:block;">ωσε</span>',
      startHere: '<span style="display:block;">Ξεκίνα</span><span style="display:block;">εδώ</span>',
    },
    panel: {
      title:       'Σχετικά με το Dash Notes',
      tagline:     'Ένας ιδιωτικός χώρος σκέψης για γρήγορα μυαλά.',
      desc:        'Βασισμένο στο πλαίσιο 3C και τη Μήτρα Eisenhower — αυτή η εφαρμογή σε βοηθά να ορίσεις στόχους, να οργανώσεις προτεραιότητες και να καταγράψεις σκέψεις.',
      worksFor:    'Ιδανικό για άτομα που',
      worksForList:'Σκέφτονται γρηγορότερα από ό,τι οργανώνονται · Θέλουν στόχους που αντικατοπτρίζουν αληθινές αξίες · Χρειάζονται να αιχμαλωτίζουν ιδέες εν κινήσει · Προτιμούν τη σαφήνεια',
      privacyTitle:'Απόρρητο',
      privacyText: 'Κανένας διακομιστής. Κανένας λογαριασμός. Τα δεδομένα δεν φεύγουν από τη συσκευή σου. Όλα αποθηκεύονται ιδιωτικά στον browser σου. Χρησιμοποίησε την ενότητα Αποθήκευση τακτικά.',
    },
    goals: {
      title:          'Στόχοι',
      subtitle:       'Ξεκίνα με τον <em>λόγο σου</em> — όχι τη λίστα υποχρεώσεών σου.',
      addBtn:         '+ Προσθήκη στόχου',
      tipCard:        '<strong style="color:var(--text-secondary);">Συμβουλή 3C:</strong> Επέλεξε 2 στόχους μεγάλους και συναρπαστικούς, 2 εύκολους και ευχάριστους, και 1 βαθύ και ουσιαστικό. Η πρόοδος νικά την τελειότητα.',
      emptyLine1:     'Κανένας στόχος ακόμα. Πρόσθεσε τον πρώτο σου στόχο παρακάτω.',
      emptyLine2:     'Ξεκίνα με το «γιατί» σου — όχι το «τι» σου.',
      editBtn:        'Επεξεργασία',
      progress:       'Πρόοδος',
      addedOn:        'Προστέθηκε',
      maxReached:     'Μέγιστο 5 στόχοι. Ολοκλήρωσε ή αφαίρεσε έναν πρώτα.',
      modalAdd:       'Προσθήκη νέου στόχου',
      modalEdit:      'Επεξεργασία στόχου',
      labelTitle:     'Τίτλος στόχου *',
      labelWhy:       'Γιατί σε νοιάζει αυτό;',
      labelMilestones:'3 ορόσημα (ένα ανά γραμμή)',
      labelReflection:'Εβδομαδιαίος αναστοχασμός',
      phTitle:        'π.χ. Ξεκίνα το 3C project μου',
      phWhy:          'Ο βαθύτερος λόγος — όχι η εργασία, το συναίσθημα...',
      phMilestones:   'Βήμα 1\nΒήμα 2\nΒήμα 3',
      phReflection:   'Τι σε προώθησε μπροστά αυτή την εβδομάδα;',
      btnSave:        'Αποθήκευση στόχου',
      btnUpdate:      'Ενημέρωση στόχου',
      toastRemoved:   'Ο στόχος αφαιρέθηκε',
      toastSaved:     'Ο στόχος αποθηκεύτηκε ✅',
      toastUpdated:   'Ο στόχος ενημερώθηκε ✅',
      toastNoTitle:   'Παρακαλώ προσθέστε τίτλο στόχου',
      confirmDelete:  'Διαγραφή αυτού του στόχου;',
    },
    matrix: {
      title:           'Μήτρα Eisenhower',
      subtitle:        'Αποφάσισε πριν αντιδράσεις. Σύρε εργασίες μεταξύ τεταρτημορίων.',
      placeholder:     'Πρόσθεσε εργασία ή απόφαση…',
      addBtn:          'Προσθήκη',
      q1:              'Κάνε πρώτα',
      q2:              'Προγραμμάτισε',
      q3:              'Ανάθεση',
      q4:              'Άφησε',
      axisUrgent:      'Επείγον',
      axisImportant:   '← Σημαντικό',
      axisNotImportant:'Μη σημαντικό →',
      tipCard:         '<strong style="color:var(--text-secondary);">Μέθοδος Eisenhower:</strong> Το επείγον είναι δυνατό. Το σημαντικό είναι ήσυχο. Η μέθοδος λειτουργεί όταν το Προγραμμάτισε γίνεται υποχρεωτικό — όχι προαιρετικό.',
    },
    voice: {
      title:                'Φωνητικές σημειώσεις',
      subtitle:             'Αιχμαλώτισε μια σκέψη πριν εξαφανιστεί — μεταγράφεται αυτόματα σε κείμενο.',
      status:               'Έτοιμο για εγγραφή. Πάτα το μικρόφωνο.',
      transcriptPlaceholder:'Τα λόγια σου θα εμφανιστούν εδώ κατά την εγγραφή…',
      browserNote:          '🎙️ Η φωνητική μεταγραφή λειτουργεί καλύτερα στο <strong style="color:var(--text-secondary);">Chrome ή Edge</strong>. Firefox και Safari έχουν περιορισμένη υποστήριξη. Ο ήχος δεν αποθηκεύεται ποτέ — μόνο το κείμενο.',
      savedTitle:           'Αποθηκευμένες φωνητικές σημειώσεις',
      emptyState:           'Καμία φωνητική σημείωση ακόμα. Καταγράψτε την πρώτη σας σκέψη.',
      micDenied:            'Απόρριψη πρόσβασης μικροφώνου — ελέγξτε τα δικαιώματα browser.',
      noSpeech:             'Δεν ανιχνεύθηκε ομιλία. Δοκιμάστε ξανά ή ελέγξτε το μικρόφωνο.',
      noteSaved:            'Φωνητική σημείωση αποθηκεύτηκε ✅',
      notSupported:         '⚠️ Η φωνητική μεταγραφή λειτουργεί καλύτερα στο Chrome ή Edge.',
      noSpeechApi:          'Η φωνητική μεταγραφή δεν είναι διαθέσιμη σε αυτόν τον browser — μόνο χρονόμετρο.',
      copied:               'Αντιγράφηκε στο πρόχειρο ✅',
    },
    notes: {
      title:              'Σημειώσεις',
      tabNote:            'Σημείωση',
      tabQuote:           'Παράθεμα',
      tabWishlist:        'Λίστα επιθυμιών',
      subjectPlaceholder: 'Θέμα ή αναφορά (προαιρετικό)',
      padPlaceholder:     'Τι σε απασχολεί; Απλώς γράψε…',
      saveBtn:            'Αποθήκευση',
      shortcut:           'ή Ctrl + Enter',
      savedTitle:         'Αποθηκεύτηκε',
      emptyState:         'Τίποτα δεν έχει αποθηκευτεί ακόμα σε αυτή την ενότητα.',
      phQuote:            'Μια σκέψη, ένα απόφθεγμα, κάτι αξίζει να κρατηθεί…',
      phWishlist:         'Κάτι που θέλεις, χρειάζεσαι ή εργάζεσαι για αυτό…',
      editLoaded:         'Η επεξεργασία φορτώθηκε — κάντε αλλαγές και πατήστε Ενημέρωση',
      toastUpdated:       'Ενημερώθηκε ✅',
      toastSaved:         'Αποθηκεύτηκε ✅',
      updateBtn:          'Ενημέρωση',
      storeBtn:           '↗ Αποθήκευση',
      copied:             'Αντιγράφηκε στο πρόχειρο ✅',
    },
    camera: {
      title:            'Λήψη κάμερας',
      subtitle:         'Φωτογράφισε μια χειρόγραφη σημείωση, πίνακα ή οτιδήποτε θέλεις να θυμάσαι. Η εικόνα παραμένει μόνο στη συσκευή σου.',
      zoneLabel:        'Πάτα για φωτογραφία ή επιλογή εικόνας από τη βιβλιοθήκη',
      noImage:          'Δεν έχει ληφθεί εικόνα. Πάτα την παραπάνω ζώνη.',
      tip:              '💡 Μετά τη λήψη, πάτα <strong style="color:var(--text-secondary);">"Κοινοποίηση / Αποθήκευση στις σημειώσεις"</strong> για να στείλεις την εικόνα στο Apple Notes, Google Keep ή οποιαδήποτε άλλη εφαρμογή.',
      shareBtn:         'Κοινοποίηση / Αποθήκευση στις σημειώσεις',
      clearBtn:         'Εκκαθάριση',
      deviceOnly:       'η εικόνα παραμένει μόνο στη συσκευή σου',
      noImageCleared:   'Δεν έχει ληφθεί εικόνα. Πάτα την παραπάνω ζώνη.',
      toastNotImage:    'Παρακαλώ επιλέξτε αρχείο εικόνας.',
      toastShareFailed: 'Η κοινοποίηση δεν υποστηρίζεται — αποθηκεύστε την εικόνα χειροκίνητα.',
      toastShareBrowser:'Χρησιμοποιήστε τον browser για αποθήκευση ή κοινοποίηση.',
    },
    backup: {
      title:              'Αποθήκευση & Επαναφορά',
      subtitle:           'Κράτα τις σκέψεις σου ασφαλείς. Κοινοποίησέ τες ή αποθήκευσε αντίγραφο.',
      storeTitle:         'Αποθήκευση σημειώσεων',
      storeDesc:          'Στείλε τους στόχους και τις σημειώσεις σου σε οποιαδήποτε εφαρμογή — app σημειώσεων, μήνυμα στον εαυτό σου ή οπουδήποτε. Ένα πάτημα ανοίγει το μενού κοινοποίησης.',
      storeBtn:           'Κοινοποίηση σημειώσεων',
      downloadTitle:      '💾 Λήψη αντιγράφου ασφαλείας',
      downloadDesc:       'Κατεβάζει πλήρες αντίγραφο των δεδομένων σου. Αποθήκευσέ το οπουδήποτε — τηλέφωνο, υπολογιστή ή cloud.',
      downloadBtn:        'Λήψη αντιγράφου',
      restoreTitle:       '🔁 Επαναφορά από αντίγραφο',
      restoreDesc:        'Κατέβασες αρχείο αντιγράφου; Πάτα παρακάτω για επαναφορά των δεδομένων σου.',
      restoreBtn:         'Επιλογή αρχείου',
      bestPracticeTitle:  'Βέλτιστη Πρακτική',
      bestPracticeText:   'Για μακροπρόθεσμες σημειώσεις, κατέβαζε τακτικά αντίγραφο ενημερώνοντας το ίδιο αρχείο. Το JSON γίνεται το εξελισσόμενο σχέδιό σου. Χρησιμοποίησε Κοινοποίηση για σύντομες σημειώσεις. Και τα δύο λειτουργούν μαζί.',
      privacyNote:        '🔒 <strong style="color:var(--text-secondary);">Σημαντικό:</strong> Εκκαθάριση δεδομένων browser διαγράφει μόνιμα τα δεδομένα σου. Κοινοποίησε ή κατέβασε αντίγραφο πρώτα. <strong style="color:var(--cyan);">Τα δεδομένα σου. Η ευθύνη σου. Η ελευθερία σου.</strong>',
      toastCopied:        'Αντιγράφηκε — επικολλήστε στην app σημειώσεων ✅',
      toastShareFailed:   'Η κοινοποίηση απέτυχε — δοκιμάστε λήψη.',
      toastDownloaded:    'Αντίγραφο ασφαλείας ληφθέν ✅',
      toastDownloadFailed:'Αποτυχία λήψης — δοκιμάστε ξανά.',
      toastBadFile:       'Αρχείο μη αναγνωρίσιμο — χρησιμοποιήστε αντίγραφο Dash Notes.',
      toastRestored:      'Τα δεδομένα αποκαταστάθηκαν ✅',
      toastRestoreFailed: 'Αποτυχία επαναφοράς — το αρχείο μπορεί να είναι κατεστραμμένο.',
    },
    tabs: {
      goals:  'Στόχοι',
      matrix: 'Μήτρα',
      voice:  'Φωνή',
      notes:  'Σημ.',
      camera: 'Κάμερα',
      backup: 'Αποθ.',
    },
    setup: {
      title:      'Ξεκίνα εδώ',
      subtitle:   'Δεν χρειάζεται πολλή διαμόρφωση — η εφαρμογή είναι σχεδιασμένη να λειτουργεί αμέσως.',
      storeTitle: 'Αποθήκευση σημειώσεων',
      storeText:  'Όταν πατάς <strong style="color:var(--text-primary);">Κοινοποίηση σημειώσεων</strong> στην Αποθήκευση, η συσκευή σου ανοίγει το δικό της μενού κοινοποίησης — το ίδιο που χρησιμοποιείς παντού. Επίλεξε όπου συνήθως κρατάς πράγματα. Δεν χρειάζεται ρύθμιση.',
      safeTitle:  'Ασφάλεια δεδομένων',
      safeText:   'Οι σημειώσεις σου ζουν μόνο σε αυτή τη συσκευή. Αν εκκαθαρίσεις τα δεδομένα browser, χάνονται. Χρησιμοποίησε <strong style="color:var(--text-primary);">Αποθ. → Κοινοποίηση</strong> ή <strong style="color:var(--text-primary);">Αποθ. → Λήψη</strong> τακτικά. Αυτό είναι το μόνο που χρειάζεται.',
      voiceTitle: 'Φωνητικές σημειώσεις',
      voiceText:  'Η φωνητική μεταγραφή λειτουργεί καλύτερα στο Chrome ή Edge σε Android. Στο iPhone, χρησιμοποίησε Safari. Η εγγραφή δεν αποθηκεύεται ποτέ — μόνο το κείμενο.',
      qaBtn:      'Ε & Α',
      qaTitle:    'Ερωτήσεις & Απαντήσεις',
      closeBtn:   'Κλείσιμο',
      leaveBtn:   'Έξοδος',
      qa: [
        { q: 'Πού αποθηκεύονται τα δεδομένα μου;',
          a: 'Όλα παραμένουν στη συσκευή σου στην τοπική αποθήκευση του browser. Τίποτα δεν αποστέλλεται σε διακομιστή. Κανείς άλλος δεν μπορεί να τα δει — ούτε οι δημιουργοί αυτής της εφαρμογής.' },
        { q: 'Τι γίνεται αν εκκαθαρίσω τα δεδομένα browser;',
          a: 'Οι σημειώσεις σου θα διαγραφούν μόνιμα. Γι αυτό η τακτική δημιουργία αντιγράφων είναι σημαντική. Χρησιμοποίησε την Αποθήκευση πριν εκκαθαρίσεις οτιδήποτε.' },
        { q: 'Πώς αποθηκεύονται οι σημειώσεις μεταξύ ενοτήτων;',
          a: 'Κάθε ενότητα αποθηκεύει αυτόματα — στόχοι, εργασίες, σημειώσεις και ηχογραφήσεις αποθηκεύονται ανεξάρτητα. Δεν χρειάζεται να αποθηκεύσεις μια συνεδρία.' },
        { q: 'Πώς βάζω την εφαρμογή στην αρχική οθόνη;',
          a: 'Σε Android: Chrome, τρεις τελείες, Προσθήκη στην αρχική οθόνη. Σε iPhone: Safari, Κοινοποίηση, Προσθήκη στην Αρχική.' },
        { q: 'Λειτουργεί χωρίς ίντερνετ;',
          a: 'Ναι — μετά το πρώτο άνοιγμα, λειτουργεί πλήρως offline. Όλα τα δεδομένα είναι στη συσκευή σου.' },
        { q: 'Πώς λειτουργεί η ηχογράφηση;',
          a: 'Πάτα το μικρόφωνο στη Φωνή, μίλα, και πάτα ξανά για να σταματήσεις. Ο browser μεταγράφει αυτόματα. Ο ήχος δεν αποθηκεύεται ποτέ — μόνο τα λόγια.' },
        { q: 'Ποιος browser λειτουργεί καλύτερα;',
          a: 'Chrome ή Edge σε Android για καλύτερη μεταγραφή. Σε iPhone, Safari. Όλες οι άλλες λειτουργίες δουλεύουν σε όλους τους σύγχρονους browsers.' },
        { q: 'Πώς επαναφέρω από αντίγραφο ασφαλείας;',
          a: 'Πήγαινε στην Αποθήκευση, πάτα Επιλογή αρχείου και επίλεξε το αρχείο που κατέβασες. Τα δεδομένα σου θα επαναφερθούν μαζί με όσα είναι ήδη αποθηκευμένα.' },
        { q: 'Βέλτιστη Πρακτική — Μακροπρόθεσμη διατήρηση',
          a: 'Για μακροπρόθεσμες σημειώσεις, κατέβαζε τακτικά αντίγραφο ενημερώνοντας το ίδιο αρχείο. Για σύντομες, χρησιμοποίησε Κοινοποίηση. Και τα δύο λειτουργούν μαζί.' },
      ],
    },
  },


  // ── PORTUGUESE ────────────────────────────────────────────────
  pt: {
    nav: {
      takeNote:  '<span style="display:block;">Tomar</span><span style="display:block;">Nota</span>',
      startHere: '<span style="display:block;">Começar</span><span style="display:block;">Aqui</span>',
    },
    panel: {
      title:       'Sobre o Dash Notes',
      tagline:     'Um espaço de pensamento privado para mentes rápidas.',
      desc:        'Baseado no quadro 3C e na Matriz de Eisenhower — esta app ajuda-te a definir objetivos, ordenar prioridades e capturar pensamentos antes que desapareçam.',
      worksFor:    'Ideal para pessoas que',
      worksForList:'Pensam mais rápido do que se organizam · Querem objetivos que reflitam valores reais · Precisam de capturar ideias em movimento · Preferem clareza ao ruído',
      privacyTitle:'Privacidade',
      privacyText: 'Nenhum servidor. Nenhuma conta. Nenhum dado sai do teu dispositivo. Tudo é armazenado em privado no teu browser. Usa a secção Guardar regularmente.',
    },
    goals: {
      title:          'Objetivos',
      subtitle:       'Começa pelo teu <em>porquê</em> — não pela tua lista de tarefas.',
      addBtn:         '+ Adicionar objetivo',
      tipCard:        '<strong style="color:var(--text-secondary);">Dica 3C:</strong> Escolhe 2 objetivos grandes e emocionantes, 2 fáceis e divertidos, e 1 profundo e significativo. O progresso supera a perfeição.',
      emptyLine1:     'Sem objetivos ainda. Adiciona o teu primeiro objetivo abaixo.',
      emptyLine2:     'Começa pelo teu «porquê» — não pelo teu «o quê».',
      editBtn:        'Editar',
      progress:       'Progresso',
      addedOn:        'Adicionado em',
      maxReached:     'Máximo de 5 objetivos. Conclui ou remove um primeiro.',
      modalAdd:       'Adicionar novo objetivo',
      modalEdit:      'Editar objetivo',
      labelTitle:     'Título do objetivo *',
      labelWhy:       'Porque é que isto é importante para ti?',
      labelMilestones:'3 marcos (um por linha)',
      labelReflection:'Reflexão semanal',
      phTitle:        'ex. Lançar o meu projeto 3C',
      phWhy:          'A razão mais profunda — não a tarefa, o sentimento...',
      phMilestones:   'Passo 1\nPasso 2\nPasso 3',
      phReflection:   'O que te fez avançar esta semana?',
      btnSave:        'Guardar objetivo',
      btnUpdate:      'Atualizar objetivo',
      toastRemoved:   'Objetivo removido',
      toastSaved:     'Objetivo guardado ✅',
      toastUpdated:   'Objetivo atualizado ✅',
      toastNoTitle:   'Por favor adiciona um título ao objetivo',
      confirmDelete:  'Apagar este objetivo?',
    },
    matrix: {
      title:           'Matriz de Eisenhower',
      subtitle:        'Decide antes de reagir. Arrasta as tarefas entre os quadrantes.',
      placeholder:     'Adicionar uma tarefa ou decisão…',
      addBtn:          'Adicionar',
      q1:              'Fazer primeiro',
      q2:              'Agendar',
      q3:              'Delegar',
      q4:              'Descartar',
      axisUrgent:      'Urgente',
      axisImportant:   '← Importante',
      axisNotImportant:'Não importante →',
      tipCard:         '<strong style="color:var(--text-secondary);">Método Eisenhower:</strong> O urgente é barulhento. O importante é silencioso. O método funciona quando Agendar se torna inegociável — não opcional.',
    },
    voice: {
      title:                'Notas de voz',
      subtitle:             'Captura um pensamento antes que desapareça — transcrito automaticamente para texto.',
      status:               'Pronto para gravar. Toque no microfone para começar.',
      transcriptPlaceholder:'As tuas palavras aparecerão aqui enquanto gravas…',
      browserNote:          '🎙️ A transcrição de voz funciona melhor no <strong style="color:var(--text-secondary);">Chrome ou Edge</strong>. Firefox e Safari têm suporte limitado. O áudio nunca é guardado — apenas o texto.',
      savedTitle:           'Notas de voz guardadas',
      emptyState:           'Sem notas de voz ainda. Grava o teu primeiro pensamento.',
      micDenied:            'Acesso ao microfone negado — verifica as permissões do browser.',
      noSpeech:             'Nenhuma fala detectada. Tenta novamente ou verifica o microfone.',
      noteSaved:            'Nota de voz guardada ✅',
      notSupported:         '⚠️ A transcrição de voz funciona melhor no Chrome ou Edge.',
      noSpeechApi:          'Transcrição de voz não disponível neste browser — apenas temporizador.',
      copied:               'Copiado para a área de transferência ✅',
    },
    notes: {
      title:              'Notas',
      tabNote:            'Nota',
      tabQuote:           'Citação',
      tabWishlist:        'Lista de desejos',
      subjectPlaceholder: 'Assunto ou referência (opcional)',
      padPlaceholder:     'O que tens em mente? Começa a escrever…',
      saveBtn:            'Guardar',
      shortcut:           'ou Ctrl + Enter',
      savedTitle:         'Guardado',
      emptyState:         'Nada guardado nesta secção ainda.',
      phQuote:            'Um pensamento, uma citação, algo que vale a pena guardar…',
      phWishlist:         'Algo que queres, precisas ou estás a trabalhar para conseguir…',
      editLoaded:         'Edição carregada — faz as alterações e toca em Atualizar',
      toastUpdated:       'Atualizado ✅',
      toastSaved:         'Guardado ✅',
      updateBtn:          'Atualizar',
      storeBtn:           '↗ Guardar',
      copied:             'Copiado para a área de transferência ✅',
    },
    camera: {
      title:            'Captura de câmara',
      subtitle:         'Fotografa uma nota manuscrita, quadro branco ou qualquer coisa que queiras lembrar. A imagem fica apenas no teu dispositivo.',
      zoneLabel:        'Toca para tirar uma foto ou escolher uma imagem da tua biblioteca',
      noImage:          'Nenhuma imagem capturada. Toca na área da câmara acima.',
      tip:              '💡 Após capturar, toca em <strong style="color:var(--text-secondary);">"Partilhar / Guardar nas notas"</strong> para enviar a imagem para o Apple Notes, Google Keep ou qualquer outra app.',
      shareBtn:         'Partilhar / Guardar nas notas',
      clearBtn:         'Limpar',
      deviceOnly:       'imagem fica apenas no teu dispositivo',
      noImageCleared:   'Nenhuma imagem capturada. Toca na área da câmara acima.',
      toastNotImage:    'Por favor seleciona um ficheiro de imagem.',
      toastShareFailed: 'Partilha não suportada — guarda a imagem manualmente.',
      toastShareBrowser:'Usa o teu browser para guardar ou partilhar esta imagem.',
    },
    backup: {
      title:              'Guardar e Restaurar',
      subtitle:           'Mantém os teus pensamentos seguros. Partilha-os ou guarda uma cópia de segurança.',
      storeTitle:         'Guardar as tuas notas',
      storeDesc:          'Envia os teus objetivos e notas para qualquer app no teu dispositivo — app de notas, mensagem para ti mesmo, ou qualquer lugar. Um toque abre o menu de partilha do teu dispositivo.',
      storeBtn:           'Partilhar as minhas notas',
      downloadTitle:      '💾 Descarregar cópia de segurança',
      downloadDesc:       'Descarrega uma cópia completa dos teus dados. Guarda-a em qualquer lugar — telemóvel, computador ou armazenamento cloud.',
      downloadBtn:        'Descarregar',
      restoreTitle:       '🔁 Restaurar da cópia de segurança',
      restoreDesc:        'Já descarregaste uma cópia de segurança? Toca abaixo para restaurar os teus dados.',
      restoreBtn:         'Escolher ficheiro',
      bestPracticeTitle:  'Boas Práticas',
      bestPracticeText:   'Para notas a longo prazo, descarrega regularmente uma cópia atualizando o mesmo ficheiro. O JSON torna-se o teu plano em evolução — sempre recuperável. Usa Partilhar para notas curtas. Ambos funcionam em conjunto.',
      privacyNote:        '🔒 <strong style="color:var(--text-secondary);">Importante:</strong> Limpar os dados do browser eliminará permanentemente os teus dados do Dash Notes. Partilha ou descarrega uma cópia primeiro. <strong style="color:var(--cyan);">Os teus dados. A tua responsabilidade. A tua liberdade.</strong>',
      toastCopied:        'Copiado — cola na tua app de notas ✅',
      toastShareFailed:   'Não foi possível partilhar — tenta descarregar.',
      toastDownloaded:    'Cópia de segurança descarregada ✅',
      toastDownloadFailed:'Descarregamento falhou — tenta novamente.',
      toastBadFile:       'Ficheiro não reconhecido — usa uma cópia de segurança Dash Notes.',
      toastRestored:      'Dados restaurados ✅',
      toastRestoreFailed: 'Restauração falhou — o ficheiro pode estar danificado.',
    },
    tabs: {
      goals:  'Objetivos',
      matrix: 'Matriz',
      voice:  'Voz',
      notes:  'Notas',
      camera: 'Câmara',
      backup: 'Guardar',
    },
    setup: {
      title:      'Começar aqui',
      subtitle:   'Não há muito a configurar — a app foi desenhada para funcionar diretamente.',
      storeTitle: 'Guardar as tuas notas',
      storeText:  'Quando tocas em <strong style="color:var(--text-primary);">Partilhar as minhas notas</strong> na secção Guardar, o teu dispositivo abre o próprio menu de partilha — o mesmo que usas em todo o lado. Escolhe onde normalmente guardas as coisas. Sem necessidade de configuração.',
      safeTitle:  'Manter os teus dados seguros',
      safeText:   'As tuas notas vivem apenas neste dispositivo. Se limpares o armazenamento do browser, perdem-se. Usa <strong style="color:var(--text-primary);">Guardar → Partilhar</strong> ou <strong style="color:var(--text-primary);">Guardar → Descarregar</strong> regularmente. É tudo o que precisas de fazer.',
      voiceTitle: 'Notas de voz',
      voiceText:  'A transcrição de voz funciona melhor no Chrome ou Edge em Android. No iPhone, usa o Safari. A gravação nunca é guardada — apenas o texto.',
      qaBtn:      'P & R',
      qaTitle:    'Perguntas & Respostas',
      closeBtn:   'Fechar',
      leaveBtn:   'Sair',
      qa: [
        { q: 'Onde são guardados os meus dados?',
          a: 'Tudo fica no teu dispositivo no armazenamento local do browser. Nada é enviado para nenhum servidor. Ninguém mais pode ver — incluindo os criadores desta app.' },
        { q: 'O que acontece se limpar os dados do browser?',
          a: 'As tuas notas serão eliminadas permanentemente. Por isso é importante fazer cópias regularmente. Usa a secção Guardar antes de limpar qualquer coisa.' },
        { q: 'Como são guardadas as minhas notas entre secções?',
          a: 'Cada secção guarda automaticamente — objetivos, tarefas, notas e gravações de voz são guardados independentemente. Não precisas de guardar uma sessão.' },
        { q: 'Como adiciono a app ao ecrã inicial do telemóvel?',
          a: 'Em Android: Chrome, três pontos, Adicionar ao ecrã inicial. No iPhone: Safari, Partilhar, Adicionar ao ecrã inicial. A app abrirá como qualquer outra app.' },
        { q: 'Funciona sem internet?',
          a: 'Sim — depois de abrir uma vez, funciona completamente offline. Todos os dados estão no teu dispositivo.' },
        { q: 'Como funciona a gravação de voz?',
          a: 'Toca no botão do microfone na secção Voz, fala e toca novamente para parar. O browser transcreve automaticamente. O áudio nunca é guardado — apenas as palavras.' },
        { q: 'Qual browser funciona melhor?',
          a: 'Chrome ou Edge em Android para a melhor transcrição de voz. No iPhone, Safari. Todas as outras funcionalidades funcionam em todos os browsers modernos.' },
        { q: 'Como restauro a partir de uma cópia de segurança?',
          a: 'Vai à secção Guardar, toca em Escolher ficheiro e seleciona o ficheiro que descarregaste. Os teus dados serão restaurados junto com o que já está guardado.' },
        { q: 'Boas Práticas — Manter notas a longo prazo',
          a: 'Para notas a longo prazo — listas, objetivos, planos — descarrega regularmente uma cópia atualizando o mesmo ficheiro. Para notas curtas, usa Partilhar. Ambos funcionam em conjunto.' },
      ],
    },
  },

}; // end translations
