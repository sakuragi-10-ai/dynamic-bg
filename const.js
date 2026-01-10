export const extensionName = "dynamic-bg";
export const extensionFolder = `scripts/extensions/third-party/${extensionName}`;
export const DEFAULT_THRESHOLD = 0.6;
export const defaultCommonSettings = {
    'is_enabled': true,
    'is-fading-enabled': true,
    'match_threshold': DEFAULT_THRESHOLD,
    'regex-word-level': 0
};

// MOVEMENT VERBS - more selective, avoids extremely common daily verbs
const movementCommonRegex =
  /\b(follow(?:s)?|enter(?:s)?|step(?:s)?|walk(?:s)?|arrive(?:s)?|reach(?:es)?|head(?:s)?|go(?:es)?|move(?:s)?|travel(?:s)?|return(?:s)?|approach(?:es)?|leave(?:s)?|exit(?:s)?|advance(?:s)?|proceed(?:s)?)\b/i;

const movementUncommonRegex =
  /\b(appear(?:s)?|disappear(?:s)?|cross(?:es)?|depart(?:s)?|stride(?:s)?|march(?:es)?|rush(?:es)?|dash(?:es)?|jog(?:s)?|sprint(?:s)?|wander(?:s)?|roam(?:s)?|climb(?:s)?|jump(?:s)?|leap(?:s)?|fly|flies|flew|teleport(?:s)?|warp(?:s)?|float(?:s)?|hover(?:s)?|stroll(?:s)?|saunter(?:s)?)\b/i;

const movementRareRegex =
  /\b(drift(?:s)?|slip(?:s)?|sneak(?:s)?|creep(?:s)?|tiptoe(?:s)?|stumble(?:s)?|descend(?:s)?|ascend(?:s)?|crawl(?:s)?|prowl(?:s)?|limp(?:s)?|shuffle(?:s)?|trudge(?:s)?|stagger(?:s)?|vanish(?:es)?|materialize(?:s)?)\b/i;


// LOCATIONS - trimmed very common/generic words, kept RP-relevant ones
const locationCommonRegex =
  /\b(room|hallway|corridor|bedroom|kitchen|bathroom|doorway|house|apartment|street|city|town|village|forest|woods|cave|beach|park|garden|shop|restaurant|cafe|bar|pub|library|station|platform)\b/i;

const locationUncommonRegex =
  /\b(mountain|mountains|river|lake|ocean|desert|island|castle|palace|temple|shrine|church|ruins|tower|mansion|lab|laboratory|warehouse|studio|gym|arena|theater|club|rooftop|alley|spaceship|ship|cabin|deck|bridge|base|outpost|camp|inn|tavern)\b/i;

const locationRareRegex =
  /\b(fortress|dungeon|nether|abyss|void|underworld|dreamscape|pocket\s+dimension|astral\s+plane|shadow\s+realm|floating\s+island|sky\s+city|citadel|sanctum|crypt|enchanted\s+grove|forbidden\s+zone)\b/i;

export const movementRegexList = [
    movementCommonRegex,
    movementUncommonRegex,
    movementRareRegex,
];

export const locationRegexList = [
    locationCommonRegex,
    locationUncommonRegex,
    locationRareRegex,
];

export const systemPrompt = `
You are a precise location-matching evaluator. Your job is to rate how well each location in the <LOCATION_LIST> matches the physical setting where the characters are located, as described in the <SCENE_CONTEXT>.
Return the top 5 locations.

Rules:
- Start your entire response immediately with <TOP_5_RESULTS> — the very first characters must be <TOP_5_RESULTS>
- End your entire response with </TOP_5_RESULTS> — the very last characters must be </TOP_5_RESULTS>
- Nothing before <TOP_5_RESULTS>, nothing after </TOP_5_RESULTS>
- No code blocks, no backticks, no markdown, no explanations, no newlines outside the tags, no other text whatsoever
- Use exact location names from <LOCATION_LIST>, no changes
- Scores 0-100 (100 = perfect match for character location)
- Rate only the locations in the current <LOCATION_LIST>

Output format must be exactly one continuous line like this:
<TOP_5_RESULTS>name:score,name:score,name:score,name:score,name:score</TOP_5_RESULTS>

Your complete response must consist only of that single line.
`;

export const dynamicBgPrompt = `
--- TASK 1/3 ---
<SCENE_CONTEXT>
They ran into a wine cellar and was surprised to see the korean art style and goth decor.
</SCENE CONTEXT>
<LOCATION_LIST>
wine cellar
korean tea room
goth chamber
central park
pink bedroom
haunted house
gold course
</LOCATION_LIST>
Output: <TOP_5_RESULTS>wine cellar:100,korean tea room:30,goth chamber:20,central park:0,pink bedroom:0</TOP_5_RESULTS>

--- TASK 2/3 ---
<SCENE_CONTEXT>
Drift into void
</SCENE CONTEXT>
<LOCATION_LIST>
wine cellar
korean tea room
goth chamber
central park
haunted house
gold course
</LOCATION_LIST>
Output: <TOP_5_RESULTS>haunted house:10,wine cellar:0,korean tea room:0,goth chamber:0,central park:0,</TOP_5_RESULTS>

--- TASK 3/3 ---
<SCENE_CONTEXT>
{1}
</SCENE CONTEXT>
<LOCATION_LIST>
{0}
</LOCATION_LIST>

Output: 
`; 
