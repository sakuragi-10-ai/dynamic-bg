import { chat, chat_metadata, event_types, eventSource, generateRaw } from "../../../../script.js";
import { stringFormat } from "../../../utils.js";
import { loadSettings, registerSettingsListeners } from "./settings/settings.js";
import { extension_settings } from '../../../extensions.js';
import { background_settings } from "../../../../scripts/backgrounds.js";
import { DEFAULT_THRESHOLD, extensionFolder, extensionName } from "./const.js";

let is_pending_response = false;
let user_msg_updated_background = false;

const systemPrompt = `
You are a precise location-matching evaluator. Your job is to rate how well each location in the <LOCATION_LIST> matches the physical setting where the characters are located, as described in the <SCENE_CONTEXT>.

Rules:
- Start your entire response immediately with <RESULT> — the very first characters must be <RESULT>
- End your entire response with </RESULT> — the very last characters must be </RESULT>
- Nothing before <RESULT>, nothing after </RESULT>
- No code blocks, no backticks, no markdown, no explanations, no newlines outside the tags, no other text whatsoever
- Use exact location names from <LOCATION_LIST>, no changes
- Scores 0–100 (100 = perfect match for character location)
- Rate only the locations in the current <LOCATION_LIST>

Output format must be exactly one continuous line like this:
<RESULT>name:score,name:score,name:score</RESULT>

Your complete response must consist only of that single line.
`;

const dynamicBgPrompt = `
EXAMPLE - DO NOT USE THIS DATA FOR SCORING:

<SCENE_CONTEXT>
They ran into a wine cellar and was surprised to see the korean art style and goth decor.
</SCENE CONTEXT>
<LOCATION_LIST>
wine cellar
korean tea room
goth chamber
central park
</LOCATION_LIST>
Output: <RESULT>wine cellar:100,korean tea room:30,goth chamber:20,central park:0</RESULT>


--- TASK ---
<SCENE_CONTEXT>
{1}
</SCENE CONTEXT>
<LOCATION_LIST>
{0}
</LOCATION_LIST>

Output: 
`; 

async function handlerCharacterMessageRendered() {
    // If user message already changed background, don't try again
    if (!is_pending_response && !user_msg_updated_background)
        handleMessageRendered(event_types.CHARACTER_MESSAGE_RENDERED);

    user_msg_updated_background = false;
}

async function handleUserMessageRendered() {
    if (!is_pending_response)
        handleMessageRendered(event_types.USER_MESSAGE_RENDERED);
}

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
    const options = bgTitles.map(x => ({ element: x, text: x.innerText.trim() })).filter(x => x.text.length > 0);
    console.log("DynamicBG: Found background options:", options);
    console.log("Current Background name: ", background_settings.name);
    if (options.length == 0) {
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
    for (const option of options) {
        const title = (option.text || '').toLowerCase();
        if (!title) continue;
        if (text.toLowerCase().includes(title)) {
            console.debug('Found matching background name:', option.text);
            matching_bg_option = option;
            break;
        }
    }

    const movementRegex =
    /\b(follow(?:s)?|enter(?:s)?|step(?:s)?|walk(?:s)?|arrive(?:s)?|reach(?:es)?|appear(?:s)?|cross(?:es)?|push(?:es)?|head(?:s)?|go(?:es)?|move(?:s)?|travel(?:s)?|return(?:s)?|approach(?:es)?|leave(?:s)?|exit(?:s)?|depart(?:s)?|disappear(?:s)?|stumble(?:s)?|advance(?:s)?|proceed(?:s)?|stride(?:s)?|march(?:es)?|rush(?:es)?|dash(?:es)?|jog(?:s)?|run(?:s)?|sprint(?:s)?|wander(?:s)?|roam(?:s)?|drift(?:s)?|slip(?:s)?|sneak(?:s)?|creep(?:s)?|climb(?:s)?|descend(?:s)?|ascend(?:s)?)\b/i;
    const movement_detected = movementRegex.test(text.toLowerCase());

    const locationRegex =
    /\b(room|hallway|corridor|building|city|town|village|forest|jungle|desert|mountain|cave|beach|ocean|ship|airplane|train|station|airport|market|shop|restaurant|cafe|bar|club|theater|museum|library|school|university|hospital|clinic|office|factory|warehouse|laboratory|studio|gym|park|garden|temple|church|mosque|synagogue|palace|castle|fortress|dungeon|space station)\b/i;
    const location_detected = locationRegex.test(text.toLowerCase());

    if (!is_pending_response && (matching_bg_option || movement_detected || location_detected)) {
        try {
            is_pending_response = true;
            await scoreAndChooseBackground(text, matching_bg_option)
        } catch (e) {
            console.error('Error scoring and choosing background:', e);
        } finally {
            is_pending_response = false;
        }
        return '';
    }

    console.debug('No matching background patterns found in the last message.');
    return '';
}

async function scoreAndChooseBackground(last_msg_str, default_bg_option) {
    /** @type {HTMLElement[]} */
    const bgTitles = Array.from(document.querySelectorAll('#bg_menu_content .BGSampleTitle'));
    const options = bgTitles.map(x => ({ element: x, text: x.innerText.trim() })).filter(x => x.text.length > 0);
    if (options.length == 0) {
        toastr.warning('No backgrounds to choose from. Please upload some images to the "backgrounds" folder.');
        return '';
    }

    const list = options.map(option => option.text).join('\n');
    const prompt = stringFormat(dynamicBgPrompt, list, last_msg_str);
    console.log("DynamicBG prompt: ", prompt);
    const reply = await generateRaw({ systemPrompt: systemPrompt, prompt: prompt, instructOverride: true });
    console.log("DynamicBG reply: ", reply);
    // If the model replied in the exact `name:score,name:score` format,
    // parse it into an array of {name, score} objects and use that result.
    function parseNameScoreReply(text, availableOptions) {
        console.log("typeof text: ", typeof text);
        if (!text || typeof text !== 'string') return null;

        const resultMatch = text.match(/<RESULT>([\s\S]*?)<\/RESULT>/i);
        const innerText = resultMatch
            ? resultMatch[1]
            : text.replace("<RESULT>", "").replace("</RESULT>", "");
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

    const parsedScores = parseNameScoreReply(reply, options);
    console.log("Parsed scores: ", parsedScores);
    if (parsedScores) {
        const threshold = (extension_settings[extensionName].match_threshold ?? DEFAULT_THRESHOLD) * 100;
        console.debug('Parsed model scores:', parsedScores);
        // choose the highest scored name that exists in `options`
        parsedScores.sort((a, b) => b.score - a.score);
        for (const item of parsedScores) {
            const match = options.find(o => o.text.toLowerCase() === item.name.toLowerCase());
            if (match) {
                if (item.score >= threshold) {
                    console.debug('Best match found:', match, item.score);
                    if (background_settings.name.includes(match.text + ".")) {
                        console.debug('Matched background is already set, not changing.');
                    } else {
                        user_msg_updated_background = true;
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