import { extension_settings } from "../../../../extensions.js";
import { saveSettingsDebounced } from "../../../../../script.js";
import { DEFAULT_THRESHOLD, extensionName } from "../const.js";

function resetMatchThreshold() {
	extension_settings[extensionName]['match-threshold'] = DEFAULT_THRESHOLD
	$("#dynamic-bg-match-threshold").val(DEFAULT_THRESHOLD);
	$("#dynamic-bg-match-threshold-value").val(DEFAULT_THRESHOLD);
	saveSettingsDebounced();
}

export function onMatchThreshold_Change() {
	const value = Number(this.value);
	if (value < 0 || value > 1) {
		console.error(`[${extensionName}] Invalid threshold value: ${value}`);
		return;
	}
	extension_settings[extensionName]['match-threshold'] = value;
	$("#dynamic-bg-match-threshold").val(value);
	$("#dynamic-bg-match-threshold-value").val(value);
	saveSettingsDebounced();
}

export function setupMatchThresholdHTML() {
	$("#dynamic-bg-match-threshold").val(
		extension_settings[extensionName]['match-threshold'],
	);
	$("#dynamic-bg-match-threshold-value").val(
		extension_settings[extensionName]['match-threshold'],
	);
}

export function setupMatchThresholdJQuery() {
	$("#dynamic-bg-match-threshold").on("input", onMatchThreshold_Change);
	$("#dynamic-bg-match-threshold-value").on("input", onMatchThreshold_Change);
	$("#dynamic-bg-match-threshold-restore").on("click", resetMatchThreshold);
}
