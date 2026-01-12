import { chat, chat_metadata, event_types, eventSource } from "../../../../script.js";
import { stringFormat } from "../../../utils.js";
import { loadSettings, registerSettingsListeners } from "./settings/settings.js";
import { extension_settings, getContext } from '../../../extensions.js';
import { background_settings } from "../../../../scripts/backgrounds.js";
import { DEFAULT_THRESHOLD, dynamicBgPrompt, extensionFolder, extensionName, movementRegexList, systemPrompt } from "./const.js";
import { generateRaw } from "./utils.js";
import { getTagKeyForEntity, getTagsList } from "../../../../scripts/tags.js";

let isPendingResponse = false;
let userMsgUpdatedBg = false;
let bgOptions = [];

async function handlerCharacterMessageRendered() {
    // If user message already changed background, don't try again
    if (!isPendingResponse && !userMsgUpdatedBg)
        handleMessageRendered(event_types.CHARACTER_MESSAGE_RENDERED);

    userMsgUpdatedBg = false;
}

async function handleUserMessageRendered() {
    if (!isPendingResponse)
        handleMessageRendered(event_types.USER_MESSAGE_RENDERED);
}

const processBgTitles = (bgTitles) =>
    // process text and extract tags for background matching
    // Extract all bracketed tags like [tag] (case-insensitive) and return them
    // along with the original trimmed text and element.
    bgTitles.map(x => {
        const raw = (x.innerText || '').trim();
        const tags = [];
        const re = /\[([^\]]+)\]/g;
        let m;
        // iterate all matches and collect lowercase, trimmed tags
        while ((m = re.exec(x.innerText || '')) !== null) {
            const tag = (m[1] || '').trim().toLowerCase();
            if (tag) tags.push(tag);
        }
        // remove all bracketed tags from the original text to produce the name
        re.lastIndex = 0; // reset regex state
        const name = raw.replace(re, ' ').trim();
        return { element: x, text: name, tags };
    }).filter(x => x.text.length > 0 || x.tags.length > 0);

const getCharacterTags = () => {
    // Get current selected character tags (tag objects)
    const ctx = getContext();
    const currentChar = ctx?.characters?.[ctx.characterId];

    if (!currentChar) {
        console.log('DynamicBG: No character selected');
    } else {
        const key = getTagKeyForEntity(currentChar); // robust key resolution
        const tagObjects = getTagsList(key); // returns array of tag objects
        const tagNames = tagObjects.map(t => t.name.toLowerCase()).filter(x => x.startsWith('bg:')).map(x => x.slice(3));
        return tagNames;
    }

    return [];
}

async function handleMessageRendered(event_type) {
    if (!extension_settings[extensionName]?.['is-enabled']) {
        return '';
    }

    console.log("DynamicBG: Message received, cycling background...");

    if (chat_metadata['custom_background']) {
        console.log("DynamicBG: Custom background is set (bg locked), skipping dynamic background selection.");
        return '';
    }
    
    /** @type {HTMLElement[]} */
    const bgTitles = Array.from(document.querySelectorAll('#bg_menu_content .BGSampleTitle'));
    const tags = (extension_settings[extensionName]?.tags || []).concat(getCharacterTags());
    bgOptions = processBgTitles(bgTitles);
    if (tags.length > 0)
        bgOptions = bgOptions.filter(option => {
            if (tags.length === 0) return true; // no tag filtering

            // check if any of the option's tags match the user-defined tags
            for (const tag of tags) {
                if (option.tags.includes(tag.toLowerCase())) {
                    return true;
                }
            }
            return false; // no matching tags found
        });
    if (bgOptions.length == 0) {
        toastr.warning('No backgrounds to choose from. Please upload some images to the "backgrounds" folder or remove tags in Extension Settings.');
        return '';
    }

    console.debug("DynamicBG: Found background options:", bgOptions);
    console.debug("DynamicBG: Current Background name: ", background_settings.name);
    if (bgOptions.length == 0) {
        toastr.warning('No backgrounds to choose from. Please upload some images to the "backgrounds" folder.');
        return '';
    }
    /** @type {ChatMessage | null} */
    const lastMsg = event_type === event_types.CHARACTER_MESSAGE_RENDERED
        ? chat.findLast(msg => !msg.is_system && !msg.is_user)
        : null;  // last character message
    const lastUserMsg = chat.findLast(msg => msg.is_user);  // last user message

    const extractText = (/** @type {ChatMessage | null} */ msg) => {
        if (!msg) return '';
        if (typeof msg === 'string') return msg;
        return msg.mes ?? '';
    };

    // Simple case-insensitive substring match: check if any background title
    // appears in the last message. Return the first matching background name.
    const text = extractText(lastUserMsg) + ' ' + extractText(lastMsg);
    console.log("DynamicBG: Analyzing text for background matching:", text);
    if (!text) return '';

    let matching_bg_option = null;
    for (const option of bgOptions) {
        const title = (option.text || '').toLowerCase();
        if (!title) continue;
        if (text.toLowerCase().includes(title)) {
            console.debug('Found matching background name:', option.text);
            matching_bg_option = option;
            break;
        }
    }

    const regexLevel = extension_settings[extensionName]?.['regex-word-level'] || 0;
    const movement_detected = movementRegexList.slice(0, regexLevel+1).some(regex =>
        regex.test(text.toLowerCase())
    );

    if (!isPendingResponse && (matching_bg_option || movement_detected)) {
        try {
            isPendingResponse = true;
            await scoreAndChooseBackground(text, matching_bg_option)
        } catch (e) {
            console.error('DynamicBG: Error scoring and choosing background:', e);
        } finally {
            isPendingResponse = false;
        }
        return '';
    }

    console.debug('DynamicBG:No matching background patterns found in the last message.');
    return '';
}

async function scoreAndChooseBackground(last_msg_str, default_bg_option) {
    const list = bgOptions.map(option => option.text).join('\n');
    const prompt = stringFormat(dynamicBgPrompt, list, last_msg_str);
    console.debug("DynamicBG prompt: ", prompt);
    const reply = await generateRaw({ systemPrompt: systemPrompt, prompt: prompt, instructOverride: true });
    console.debug("DynamicBG reply: ", reply);

    function parseNameScoreReply(text) {
        if (!text || typeof text !== 'string') return null;

        const resultMatch = text.match(/<RESULT>([\s\S]*?)<\/RESULT>/i);
        const innerText = resultMatch
            ? resultMatch[1]
            : text.replace("<RESULT>", "").replace("</RESULT>", "");

        const parts = innerText.split(',').map(p => p.trim()).filter(Boolean);
        if (parts.length === 0) return null;

        const idx = innerText.lastIndexOf(':');
        if (idx === -1) return null; // missing ':'
        const name = innerText.slice(0, idx).trim();
        const scoreStr = innerText.slice(idx + 1).trim();
        const score = Number(scoreStr);
        if (!Number.isFinite(score) || score < 0 || score > 100) return null; // invalid score

        return { name, score };
    }

    const nameAndScore = parseNameScoreReply(reply) || { name: "unknown", score: 100 };
    if (nameAndScore.name == 'unknown') return '';
    console.debug("DynamicBGName and Score: ", nameAndScore);

    const threshold = (extension_settings[extensionName]['match-threshold'] ?? DEFAULT_THRESHOLD) * 100;
    // choose the highest scored name that exists in `options`

    const match = bgOptions.find(o => o.text.toLowerCase() === nameAndScore.name.toLowerCase());
    if (match) {
        if (nameAndScore.score >= threshold) {
            if (background_settings.name.includes(match.text + ".")) {
                console.debug('DynamicBG: Matched background is already set, not changing.');
            } else {
                userMsgUpdatedBg = true;
                if (extension_settings[extensionName]?.['is-fading-enabled']) {
                    $('#bg1').fadeOut(1000);
                    setTimeout(() => {
                        match.element.click();
                        $('#bg1').fadeIn(1000);
                    }, 1000);
                } else {
                    match.element.click();
                }
            }  
            return '';
        } else {
            console.debug('DynamicBG: Match scored below threshold:', threshold);
            return '';
        }
    } else {
        console.debug('DynamicBG: Parsed name not found among available backgrounds:', nameAndScore.name);
    }
    
    console.debug('DynamicBG: Parsed names not found among available backgrounds, falling back.');

    if (default_bg_option) {
        console.debug('DynamicBG: Fallback choosing background:', default_bg_option);
        default_bg_option.element.click();
    } else {
        console.debug('DynamicBG: No fallback background to choose, don\'t do anything.');
    }
    return '';
}

jQuery(async () => {
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, handlerCharacterMessageRendered);
    eventSource.on(event_types.USER_MESSAGE_RENDERED, handleUserMessageRendered);
    const settingsHtml = await $.get(`${extensionFolder}/settings/settings.html`);

    $('#extensions_settings').append(settingsHtml);
    console.log("Dynamic BG settings loaded: settings:", `${extensionFolder}/settings/settings.html`);
    await loadSettings();
    registerSettingsListeners();

    console.log("Dynamic Background Extension Loaded");
});