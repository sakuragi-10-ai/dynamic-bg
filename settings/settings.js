import { setupMatchThresholdHTML, setupMatchThresholdJQuery } from './scale.js';
import { extension_settings } from '../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../script.js';
import { defaultCommonSettings, extensionName } from '../const.js';

function onEnable_Change() {
    const value = Boolean($(this).prop("checked"));
    extension_settings[extensionName]['is-enabled'] = value;
    saveSettingsDebounced();
}

function onFadingEnable_Change() {
    const value = Boolean($(this).prop("checked"));
    extension_settings[extensionName]['is-fading-enabled'] = value;
    saveSettingsDebounced();
}

function onTags_Change() {
    const value = $(this).val().trim();
    const tags = value.split(',').map(t => t.trim()).filter(Boolean);
    extension_settings[extensionName].tags = tags;
    saveSettingsDebounced();
}

function onRegexWordLevel_Change() {
    const value = Number($(this).val());
    if (isNaN(value) || value < 0 || value > 2) {
        console.error(`[${extensionName}] Invalid regex word level: ${value}`);
        return;
    }
    extension_settings[extensionName]['regex-word-level'] = value;
    saveSettingsDebounced();
}

/**
 * @return {void}
 */
export function registerSettingsListeners() {
    $("#dynamic-bg-is-enabled").on("input", onEnable_Change);
    $("#dynamic-bg-is-fading-enabled").on("input", onFadingEnable_Change);
    $("#dynamic-bg-tags").on("input", onTags_Change);
    $("#dynamic-bg-regex-word-level").on("input", onRegexWordLevel_Change);
    setupMatchThresholdJQuery();
}

/**
 * @return {Promise<void>}
 */
export async function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    setDefaultsForUndefined(extension_settings[extensionName]);

    $('#dynamic-bg-is-enabled').prop('checked', extension_settings[extensionName]['is-enabled']).trigger('input');
    $('#dynamic-bg-is-fading-enabled').prop('checked', extension_settings[extensionName]['is-fading-enabled']).trigger('input');
    $('#dynamic-bg-tags').val((extension_settings[extensionName].tags || []).join(', '));
    $('#dynamic-bg-regex-word-level').val(extension_settings[extensionName]['regex-word-level'] || 0);
    setupMatchThresholdHTML();
}

/**
 * @param {object} settings
 */
function setDefaultsForUndefined(settings) {
    for (const settingKey in defaultCommonSettings) {
        if (settings[settingKey] === undefined) {
            settings[settingKey] = defaultCommonSettings[settingKey];
        }
    }
}
