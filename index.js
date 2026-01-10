import { chat, chat_metadata, event_types, eventSource, generateRaw } from "../../../../script.js";
import { stringFormat } from "../../../utils.js";
import { loadSettings, registerSettingsListeners } from "./settings/settings.js";
import { extension_settings } from '../../../extensions.js';
import { background_settings } from "../../../../scripts/backgrounds.js";
import { DEFAULT_THRESHOLD, dynamicBgPrompt, extensionFolder, extensionName, locationRegexList, movementRegexList, systemPrompt } from "./const.js";

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

const process_bgTitles = (bgTitles) =>
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

async function handleMessageRendered(event_type) {
    if (!extension_settings[extensionName]?.is_enabled) {
        return '';
    }

    console.log("DynamicBG: Message received, cycling background...");

    if (chat_metadata['custom_background']) {
        console.log("DynamicBG: Custom background is set (bg locked), skipping dynamic background selection.");
        return '';
    }
    
    /** @type {HTMLElement[]} */
    const bgTitles = Array.from(document.querySelectorAll('#bg_menu_content .BGSampleTitle'));
    bgOptions = process_bgTitles(bgTitles).filter(option => {
        const tags = extension_settings[extensionName]?.tags || [];
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

    console.log("DynamicBG: Found background options:", bgOptions);
    console.log("Current Background name: ", background_settings.name);
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
    const location_detected = locationRegexList.slice(0, regexLevel+1).some(regex =>
        regex.test(text.toLowerCase())
    );

    if (!isPendingResponse && (matching_bg_option || movement_detected || location_detected)) {
        try {
            isPendingResponse = true;
            await scoreAndChooseBackground(text, matching_bg_option)
        } catch (e) {
            console.error('Error scoring and choosing background:', e);
        } finally {
            isPendingResponse = false;
        }
        return '';
    }

    console.debug('No matching background patterns found in the last message.');
    return '';
}

async function scoreAndChooseBackground(last_msg_str, default_bg_option) {
    const list = bgOptions.map(option => option.text).join('\n');
    const prompt = stringFormat(dynamicBgPrompt, list, last_msg_str);
    console.log("DynamicBG prompt: ", prompt);
    const reply = await generateRaw({ systemPrompt: systemPrompt, prompt: prompt, instructOverride: true });
    console.log("DynamicBG reply: ", reply);
    // If the model replied in the exact `name:score,name:score` format,
    // parse it into an array of {name, score} objects and use that result.
    function parseNameScoreReply(text, availableOptions) {
        console.log("typeof text: ", typeof text);
        if (!text || typeof text !== 'string') return null;

        const resultMatch = text.match(/<TOP_5_RESULTS>([\s\S]*?)<\/TOP_5_RESULTS>/i);
        const innerText = resultMatch
            ? resultMatch[1]
            : text.replace("<TOP_5_RESULTS>", "").replace("</TOP_5_RESULTS>", "");
        console.log("extracted innerText:", innerText);

        const parts = innerText.split(',').map(p => p.trim()).filter(Boolean);
        if (parts.length === 0) return [];

        const out = [];
        for (const part of parts) {
            const idx = part.lastIndexOf(':');
            if (idx === -1) continue; // missing ':'
            const name = part.slice(0, idx).trim();
            const scoreStr = part.slice(idx + 1).trim();
            console.log("name: ", name, " scoreStr: ", scoreStr);
            if (!name || scoreStr.length === 0) continue;
            const score = Number(scoreStr);
            if (!Number.isFinite(score) || score < 0 || score > 100) continue;
            out.push({ name, score });
        }

        return out;
    }

    const parsedScores = parseNameScoreReply(reply, bgOptions);
    console.log("Parsed scores: ", parsedScores);
    if (parsedScores) {
        const threshold = (extension_settings[extensionName].match_threshold ?? DEFAULT_THRESHOLD) * 100;
        console.debug('Parsed model scores:', parsedScores);
        // choose the highest scored name that exists in `options`
        parsedScores.sort((a, b) => b.score - a.score);
        for (const item of parsedScores) {
            const match = bgOptions.find(o => o.text.toLowerCase() === item.name.toLowerCase());
            if (match) {
                if (item.score >= threshold) {
                    console.debug('Best match found:', match, item.score);
                    if (background_settings.name.includes(match.text + ".")) {
                        console.debug('Matched background is already set, not changing.');
                    } else {
                        userMsgUpdatedBg = true;
                        if (extension_settings[extensionName]?.is_fading_enabled) {
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
                    console.debug('Match scored below threshold:', threshold);
                    toastr.info('No background matched the scene well enough.');
                    return '';
                }
            } else {
                console.debug('Parsed name not found among available backgrounds:', item.name);
            }
        }
        console.debug('Parsed names not found among available backgrounds, falling back.');
    }

    if (default_bg_option) {
        console.debug('Fallback choosing background:', default_bg_option);
        default_bg_option.element.click();
    } else {
        console.debug('No fallback background to choose, don\'t do anything.');
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