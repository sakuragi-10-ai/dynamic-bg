export const extensionName = "dynamic-bg";
export const extensionFolder = `scripts/extensions/third-party/${extensionName}`;
export const DEFAULT_THRESHOLD = 0.8;
export const defaultCommonSettings = {
    'is_enabled': true,
    'is_fading_enabled': true,
    'match_threshold': DEFAULT_THRESHOLD,
    'regex_word_level': 0
};

// MOVEMENT VERBS - STRICT (ultra-high confidence: almost always means actual traversal / entering a new discrete location)
const movementStrictRegex = 
/\b(enter(?:s)?|exit(?:s)?|leave(?:s)?|arrive(?:s)?|depart(?:s)?)\b/i;

// MOVEMENT VERBS - COMMON (still strong movement, but allows some directed intent without strict boundary)
const movementCommonRegex = 
/\b(follow(?:s)?|cross(?:es)?|step(?:s)?|walk(?:s)?|move(?:s)?|head(?:s)?|stride(?:s)?|march(?:es)?|rush(?:es)?|dash(?:es)?|jog(?:s)?|sprint(?:s)?|reach(?:es)?)\b/i;

// MOVEMENT VERBS - UNCOMMON (stylized/specific, often implies path or manner with location change)
const movementUncommonRegex = 
/\b(wander(?:s)?|roam(?:s)?|climb(?:s)?|descend(?:s)?|ascend(?:s)?|jump(?:s)?|leap(?:s)?|fly|flies|flew|teleport(?:s)?|warp(?:s)?|float(?:s)?|hover(?:s)?|stroll(?:s)?|saunter(?:s)?|advance(?:s)?|proceed(?:s)?)\b/i;

// MOVEMENT VERBS - RARE (mostly manner/appearance, highest ambiguity for pure location change)
const movementRareRegex = 
/\b(appear(?:s)?|disappear(?:s)?|drift(?:s)?|slip(?:s)?|sneak(?:s)?|creep(?:s)?|tiptoe(?:s)?|stumble(?:s)?|crawl(?:s)?|prowl(?:s)?|limp(?:s)?|shuffle(?:s)?|trudge(?:s)?|stagger(?:s)?|vanish(?:es)?|materialize(?:s)?|return(?:s)?)\b/i;

export const movementRegexList = [
  movementStrictRegex,
  movementCommonRegex,
  movementUncommonRegex,
  movementRareRegex,
];

export const systemPrompt = `
You are a strict location-change detection and classification engine that only analyzes the physical descriptions of the scene context. Never make assumptions about abstract concepts, emotions, or non-physical elements.
Before producing your final answer, internally compare all candidate locations against the scene evidence. Do not reveal this comparison.

Rules:
- Use the same exact format for every TASK
- No code blocks, no backticks, no markdown, no newlines outside the tags, no other text whatsoever
- Use exact location names from <LOCATION_LIST>, no changes

Output is a single location name from the <LOCATION_LIST> that best matches the scene context, with the confidence score (0 to 100).
`;

export const dynamicBgPrompt = `
--- TASK 1/4 ---
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
unknown
</LOCATION_LIST> 

Output: <RESULT>wine cellar:100</RESULT>

--- TASK 2/4 ---
<SCENE_CONTEXT>
Drift into space, surrounded by the void.
</SCENE CONTEXT>
<LOCATION_LIST>
wine cellar
korean tea room
goth chamber
central park
haunted house
gold course
unknown
</LOCATION_LIST>

Output: <RESULT>unknown:100</RESULT>

--- TASK 3/4 ---
<SCENE_CONTEXT>
They looked around and saw tall trees and heard birds chirping.
</SCENE CONTEXT>
<LOCATION_LIST>
wine cellar
korean tea room
goth chamber
central park
haunted house
gold course
unknown
</LOCATION_LIST>

Output: <RESULT>central park:40</RESULT>

--- TASK 4/4 ---
<SCENE_CONTEXT>
{1}
</SCENE CONTEXT>
<LOCATION_LIST>
{0}
unknown
</LOCATION_LIST>

Output: 
`; 

export const bksystemPrompt = `
You are a strict location-change detection and classification engine that only analyzes the physical descriptions of the scene context. Never make assumptions about abstract concepts, emotions, or non-physical elements.
Before producing your final answer, internally compare all candidate locations against the scene evidence. Do not reveal this comparison.

Rules:
- Use the same exact format for every TASK
- No code blocks, no backticks, no markdown, no newlines outside the tags, no other text whatsoever
- Use exact location names from <LOCATION_LIST>, no changes
- Scores 0-100 (100 = perfect match for character location)
- Rate only the locations in the current <LOCATION_LIST>

Output format must be exactly one continuous line like this:
<CHANGED>bool</CHANGED><TOP_5_RESULTS>name:score,name:score,name:score,name:score,name:score</TOP_5_RESULTS>

Your complete response must consist only of that single line.
`;

export const bkdynamicBgPrompt = `
--- TASK 1/4 ---
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

Output: <CHANGED>YES</CHANGED><TOP_5_RESULTS>wine cellar:100,korean tea room:30,goth chamber:20,central park:0,pink bedroom:0</TOP_5_RESULTS>

Explanation: the text explicitly mentions "wine cellar" and "korean art style" and "goth decor", which directly correspond to the first three locations. The other locations are not mentioned at all.

--- TASK 2/4 ---
<SCENE_CONTEXT>
Drift into space, surrounded by the void.
</SCENE CONTEXT>
<LOCATION_LIST>
wine cellar
korean tea room
goth chamber
central park
haunted house
gold course
</LOCATION_LIST>

Output: <CHANGED>YES</CHANGED><TOP_5_RESULTS>haunted house:10,wine cellar:0,korean tea room:0,goth chamber:0,central park:0</TOP_5_RESULTS>

Explanation: the word "void" suggests a supernatural or eerie setting, which loosely aligns with "haunted house", but is not close to representing the actual location. The other locations have no relation to "void".

--- TASK 3/4 ---
<SCENE_CONTEXT>
They looked around and saw tall trees and heard birds chirping.
</SCENE CONTEXT>
<LOCATION_LIST>
wine cellar
korean tea room
goth chamber
central park
haunted house
gold course
</LOCATION_LIST>

Output: <CHANGED>NO</CHANGED><TOP_5_RESULTS></TOP_5_RESULTS>

Explanation: there are no descriptions hinting at movement or location change. The scene remains static.

--- TASK 4/4 ---
<SCENE_CONTEXT>
{1}
</SCENE CONTEXT>
<LOCATION_LIST>
{0}
</LOCATION_LIST>

Output: 
`; 
