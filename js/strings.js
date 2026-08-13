// strings.js
// Every user-facing string in the app lives here, keyed by id. Nothing
// else should have English text hardcoded into it — screens reference
// t('some_id') or render data-i18n="some_id" instead. Only English is
// filled in; this is the structural groundwork for future locales, not
// localization itself, per how this was asked for.
//
// Data modules (exercise-log.js, gap-fixer.js) intentionally hold IDs
// and numbers only, no display text — their labels live here too,
// looked up by the same id, so a data module never needs to import a
// UI concern and strings.js stays the one place all display text lives.

export const STRINGS = {
  // ---- App-wide ----
  app_name: 'MacroLoop',
  app_tagline: 'Track what you eat, without the guesswork.',
  generic_load_error: 'Could not load your data — check your connection.',
  label_log_it: 'Log it',
  aria_close: 'Close',
  aria_sign_out: 'Sign out',
  aria_decrease: 'Decrease',
  aria_increase: 'Increase',
  aria_delete_entry: 'Delete entry',
  aria_log_exercise: 'Log exercise',
  aria_log_weight: 'Log weight',

  // ---- Pre-auth intro sequence ----
  intro1_tagline: 'The calorie tracker that learns your body, instead of guessing at it forever.',
  intro_get_started_button: 'Get started',
  intro_skip_button: 'Skip intro',
  intro_continue_button: 'Continue',
  intro_have_account_button: 'Already have an account? Sign in',
  intro2_headline: 'Most apps use one formula. Forever.',
  intro2_body: "MacroLoop starts with the same kind of estimate every tracker uses. But no formula knows your actual metabolism — so after about two weeks of logging, it quietly adjusts your targets based on what's really happening, not just your age and weight.",
  intro2_week1_label: 'Week 1',
  intro2_week1_value: 'Standard formula',
  intro2_week3_label: 'Week 3+',
  intro2_week3_value: 'Personalized to you',
  intro3_headline: 'Snap a photo, skip the search',
  intro3_body: "Point your camera at a plate and MacroLoop identifies what's on it — no scrolling through a food database to log a meal.",
  quick_add_photo_aria: 'Log a meal photo',

  // ---- Onboarding wizard / notification opt-in ----
  result_ready_label: 'Your plan is ready',
  notif_headline: 'Stay on track',
  notif_body: "If you haven't hit your macros by a time you pick, MacroLoop shows a gentle reminder on Today. Set it now, or skip and add it later in Settings.",
  notif_enable_button: 'Set reminder & finish',
  notif_skip_button: 'Skip for now',
  aria_regenerate: 'Regenerate',
  aria_settings: 'Settings',
  aria_search: 'Search',
  aria_recent: 'Recent',
  aria_back: 'Back',

  // ---- Settings ----
  settings_screen_title: 'Settings',

  settings_section_appearance: 'Appearance',
  settings_appearance_note: 'Pick the accent that feels like you — it carries through the whole app.',

  settings_tour_title: 'App tour',
  settings_tour_note: 'A quick walk through what everything does.',

  tutorial_skip: 'Skip',
  tutorial_back: 'Back',
  tutorial_next: 'Next',
  tutorial_finish: 'Done',

  tutorial_step_orbit_title: 'Your dial',
  tutorial_step_orbit_body: 'The number in the middle is what matters most right now — it changes meaning depending on which page you\u2019re on. Tap a moon, or swipe left and right on the dial, to move between sections.',
  tutorial_step_photo_title: 'Log a meal',
  tutorial_step_photo_body: 'Take a photo of your food and MacroLoop estimates the calories and macros for you \u2014 no manual lookup needed.',
  tutorial_step_macros_title: 'Your macros',
  tutorial_step_macros_body: 'Protein, carbs, and fat, tracked separately from calories \u2014 each ring fills as you log food today.',
  tutorial_step_exercise_title: 'Exercise',
  tutorial_step_exercise_body: 'Log a workout here and MacroLoop adds the calories back to your budget for the day.',
  tutorial_step_progress_title: 'Progress over time',
  tutorial_step_progress_body: 'Your weight and calorie trends, plus how the adaptive algorithm is adjusting your target as it learns your body.',
  tutorial_step_fixer_title: 'Gap Fixer',
  tutorial_step_fixer_body: 'Behind on protein with not much of your budget left? Fixer finds realistic combinations that actually fit.',
  tutorial_step_flex_title: 'Your week, summarized',
  tutorial_step_flex_body: 'A shareable weekly recap \u2014 days logged, your streak, and how consistent you\u2019ve been.',
  tutorial_step_settings_title: 'Make it yours',
  tutorial_step_settings_body: 'Update your profile and goals any time, and pick an accent color that feels like you.',

  settings_section_profile: 'Profile',
  settings_profile_note: "Updating these recalculates your target — same formula as onboarding.",
  settings_save_profile_button: 'Save changes',
  settings_password_fields_required: 'Enter both your current and new password.',
  toast_profile_saved: 'Profile updated — target recalculated',

  settings_section_notifications: 'Notifications',
  label_gap_fixer_time: 'Gap Fixer reminder',
  gap_fixer_time_off: 'Off',
  settings_gap_fixer_note: "If you haven't hit your macros by this time, a reminder appears on Today. Checked only while the app is open — not a push notification yet.",

  settings_section_subscription: 'Subscription',
  plan_free: 'Free plan',
  plan_premium: 'Premium',
  photo_scans_used: '{used}/{limit} photo scans used this month',
  photo_scans_unlimited: 'Unlimited photo scans',
  adaptive_algorithm_premium_note: 'Personalized Mode (the adaptive algorithm) is a premium feature — free accounts use the standard formula.',
  settings_upgrade_button: 'Upgrade to Premium',
  toast_upgrade_coming_soon: "Upgrades aren't set up yet — this is a placeholder for now.",

  settings_section_data: 'Your data',
  settings_export_button: 'Export my data',
  settings_export_note: 'Downloads everything — profile, logs, and history — as a JSON file.',
  toast_export_ready: 'Export downloaded',
  settings_delete_account_button: 'Delete account',
  settings_section_danger: 'Danger zone',
  settings_delete_warning_short: 'Permanently deletes your account and everything you\u2019ve logged.',
  settings_delete_warning: 'This permanently deletes your account and every entry you\u2019ve logged. This cannot be undone.',
  settings_delete_confirm_password_label: 'Enter your password to confirm',
  settings_delete_confirm_button: 'Permanently delete my account',
  settings_delete_final_confirm: 'Last check — this deletes everything and cannot be undone. Are you sure?',
  settings_delete_password_required: 'Enter your password to confirm.',
  toast_account_deleted: 'Account deleted',

  settings_section_account: 'Account',
  label_email: 'Email',
  settings_change_password_button: 'Change password',
  label_current_password: 'Current password',
  label_new_password: 'New password',
  settings_save_password_button: 'Update password',
  toast_password_changed: 'Password updated',
  settings_signout_button: 'Sign out',

  settings_section_about: 'About',
  settings_disclaimer: 'MacroLoop provides general nutrition estimates and is not medical advice. It does not diagnose, treat, or replace guidance from a doctor or registered dietitian — talk to one before making changes if you have a medical condition, are pregnant, or are under 18.',
  settings_app_blurb: "MacroLoop estimates your energy needs from your own logged data over time, instead of a fixed formula that never adjusts.",

  gap_fixer_nudge_text: "Haven't hit your macros yet today — a few realistic options are ready.",
  gap_fixer_nudge_action: 'Open Gap Fixer',
  gap_fixer_nudge_dismiss: 'Dismiss',

  // ---- Auth ----
  auth_email_label: 'Email',
  auth_password_label: 'Password',
  auth_signin_button: 'Sign in',
  auth_signup_button: 'Create account',
  auth_toggle_to_signup: 'Need an account? Create one',
  auth_toggle_to_signin: 'Already have an account? Sign in',
  auth_error_wrong_password: 'Incorrect email or password.',
  auth_error_email_in_use: 'That email already has an account — try signing in instead.',
  auth_error_weak_password: 'Password should be at least 6 characters.',
  auth_error_invalid_email: 'That email address looks invalid.',
  auth_error_generic: 'Something went wrong. Please try again.',

  // ---- Onboarding ----
  onboarding_title: "Let's set your target",
  onboarding_subtitle: 'Takes under two minutes.',
  onboarding_step_units: 'Units',
  unit_metric: 'Metric',
  unit_imperial: 'Imperial',
  onboarding_step_about_you: 'About you',
  label_sex: 'Sex',
  sex_female: 'Female',
  sex_male: 'Male',
  label_age: 'Age',
  label_height_cm: 'Height (cm)',
  label_height_ft_in: 'Height (ft / in)',
  label_weight_kg: 'Weight (kg)',
  label_weight_lb: 'Weight (lb)',
  onboarding_step_activity: 'Activity',
  label_activity_level: 'Typical activity level',
  activity_sedentary: 'Sedentary — little to no exercise',
  activity_light: 'Light — exercise 1-3 days/week',
  activity_moderate: 'Moderate — exercise 3-5 days/week',
  activity_active: 'Active — exercise 6-7 days/week',
  activity_very_active: 'Very active — physical job or 2x/day training',
  onboarding_step_goal: 'Goal',
  goal_lose: 'Lose',
  goal_maintain: 'Maintain',
  goal_gain: 'Gain',
  label_rate: 'Target rate (% bodyweight/week)',
  label_target_weight_kg: 'Goal weight (kg) — optional',
  label_target_weight_lb: 'Goal weight (lb) — optional',
  healthy_range_hint_metric: 'Healthy range for your height: {min}\u2013{max} kg. Just a guide — set any goal weight you like.',
  healthy_range_hint_imperial: 'Healthy range for your height: {min}\u2013{max} lb. Just a guide — set any goal weight you like.',
  onboarding_error_missing_fields: 'Please fill in your age, height, and weight.',
  onboarding_calculate_button: 'Calculate my target',
  unit_kcal_per_day: 'kcal/day',
  onboarding_get_started_button: 'Get started',
  explain_target_maintain: "Based on your stats, your body burns about {tdee} kcal/day at rest and activity combined — that's your starting target.",
  explain_target_goal: 'Your estimated maintenance is {tdee} kcal/day (from a {bmr} kcal base rate). Your target of {target} kcal/day is set {direction} that to match your goal.',
  direction_below: 'below',
  direction_above: 'above',
  warning_floor_clamped: 'Your selected rate would drop below a safe daily minimum, so your target is capped there. Talk to a doctor or dietitian before going lower.',
  warning_rate_aggressive: 'That rate is faster than the ~0.5–1% of bodyweight/week most guidance treats as sustainable.',

  // ---- Today ----
  hero_label_remaining: 'kcal remaining',
  exercise_credit_note: 'Budget includes +{amount} kcal from exercise',
  macro_protein: 'Protein',
  macro_carbs: 'Carbs',
  macro_fat: 'Fat',
  quick_add_search: '<span class="icon icon-search" aria-hidden="true"></span> Search',
  quick_add_recent: '<span class="icon icon-recent" aria-hidden="true"></span> Recent',
  quick_add_photo: '<span class="icon icon-photo" aria-hidden="true"></span> Photo',
  todays_log_heading: "Today's log",
  empty_food_log: 'Nothing logged yet today. Tap Search to add your first meal.',
  toast_logged_item: 'Logged {name}',

  // ---- Exercise screen ----
  exercise_screen_title: 'Exercise',
  exercise_kcal_burned_today: 'kcal burned today',
  todays_exercise_heading: "Today's exercise",
  empty_exercise_log: 'No exercise logged yet today.',
  exercise_minutes_suffix: 'min',
  toast_exercise_missing_input: 'Enter a duration (or calories, for a custom activity) first.',
  toast_logged_exercise: 'Logged {activity}',

  // ---- Log Exercise sheet ----
  log_exercise_title: 'Log exercise',
  label_activity: 'Activity',
  label_duration_minutes: 'Duration (minutes)',
  label_calories_burned: 'Calories burned',
  placeholder_calories_example: 'e.g. 300',
  activity_walking_moderate: 'Walking (moderate pace)',
  activity_walking_brisk: 'Walking (brisk pace)',
  activity_running_8kmh: 'Running (~8 km/h / 5 mph)',
  activity_running_10min_mi: 'Running (10 min/mile)',
  activity_running_8min_mi: 'Running (8 min/mile)',
  activity_cycling_moderate: 'Cycling (moderate)',
  activity_cycling_vigorous: 'Cycling (vigorous)',
  activity_swimming: 'Swimming (laps, moderate)',
  activity_weightlifting: 'Weightlifting (general)',
  activity_yoga: 'Yoga',
  activity_hiit: 'HIIT',
  activity_elliptical: 'Elliptical',
  activity_basketball: 'Basketball',
  activity_soccer: 'Soccer',
  activity_rowing: 'Rowing (moderate)',
  activity_stairs: 'Stair climbing',
  activity_dancing: 'Dancing',
  activity_custom: 'Other (enter calories manually)',

  // ---- Progress screen ----
  progress_screen_title: 'Progress',
  weight_card_title: 'Weight',
  daily_calories_card_title: 'Daily calories',
  weight_trend_needs_more_data: 'Log a few more check-ins to see a trend.',
  weight_trend_summary: '{sign}{value} over {count} check-ins',
  days_to_target_summary: '~{days} days to your goal weight at this pace',
  days_to_target_reached: "You're at your goal weight",
  calorie_trend_no_logs: 'No logs yet in this window.',
  calorie_trend_summary: 'Averaging {avg} kcal/day ({sign}{diff} vs target) over {count} logged days',
  algorithm_panel_title_learning: 'Personalization',
  algorithm_panel_learning_body: "Still in <strong>Learning Mode</strong>, using the standard formula. Personalizes automatically once you've logged food most days for about two weeks.",
  algorithm_panel_title_personalized: 'Personalization — <span style="color:var(--success);">Personalized Mode</span>',
  algorithm_panel_personalized_body: 'Started at {startTarget} kcal. After {days} days of your data, adjusted to {nowTarget} kcal — {explanation}.',
  algo_explain_lose_faster: 'your actual weight loss was faster than expected at that intake',
  algo_explain_lose_slower: 'your actual weight loss was slower than expected at that intake',
  algo_explain_lose_same: 'your actual weight loss matched what the standard formula predicted',
  algo_explain_gain_faster: 'your actual weight gain was faster than expected at that intake',
  algo_explain_gain_slower: 'your actual weight gain was slower than expected at that intake',
  algo_explain_gain_same: 'your actual weight gain matched what the standard formula predicted',
  algo_explain_maintain_higher: 'your metabolism is running a bit higher than the standard formula assumed',
  algo_explain_maintain_lower: 'your metabolism is running a bit lower than the standard formula assumed',
  algo_explain_maintain_same: 'your metabolism matched what the standard formula predicted',

  // ---- Nav ----
  nav_today: 'Today',
  nav_exercise: 'Exercise',
  nav_progress: 'Progress',
  nav_fixer: 'Fixer',
  nav_flex: 'Flex',

  // ---- Log Meal sheet ----
  sheet_title_add_food: 'Add food',
  sheet_title_search_foods: 'Search foods',
  sheet_title_recent_foods: 'Recent foods',
  search_placeholder: 'Search foods (e.g. chicken breast)',
  back_to_search: '← Back to search',
  empty_frequent_foods: 'No frequent foods yet — search once and it will show up here.',
  empty_search_results: 'No matches. Try a simpler search term.',
  search_failed: 'Search failed — check your connection and try again.',
  per_100g_summary: '{calories} kcal · {protein}p / {carbs}c / {fat}f per 100g',
  scaled_summary: '{calories} kcal · {protein}p / {carbs}c / {fat}f',

  // ---- Log Weight sheet ----
  log_weight_title: 'Log weight',
  toast_weight_missing: 'Enter a weight first.',
  toast_weight_logged: 'Weight logged',
  save_button: 'Save',

  // ---- Photo logging ----
  photo_review_title: 'Review your meal',
  photo_review_subtitle: 'Estimated from your photo — check the numbers, especially anything flagged low confidence, before logging.',
  photo_remove_item: 'Remove',
  confidence_high: 'High confidence',
  confidence_medium: 'Medium confidence',
  confidence_low: 'Low confidence',
  photo_log_meal_button: 'Log this meal',
  photo_all_removed: 'All items removed. Close and retake the photo, or log manually instead.',
  photo_nothing_to_log: 'Nothing to log — remove all items or retake the photo.',
  photo_field_calories: 'kcal',
  photo_field_protein: 'protein',
  photo_field_carbs: 'carbs',
  photo_field_fat: 'fat',
  photo_analyzing: 'Analyzing your photo…',
  photo_unidentified_name: 'Unidentified item',
  photo_unidentified_note: "Couldn't identify this item — add the details yourself, or remove it.",
  photo_needs_attention_banner: 'Some items need a closer look before logging — check the flags below.',
  toast_logged_photo_items: 'Logged {count} item{plural}',
  toast_photo_no_items_recognized: 'Could not identify any food in that photo — try a clearer shot, or search manually.',
  toast_photo_limit_reached: "You've used your {limit} free photo scans this month. Manual search still works anytime.",
  toast_photo_validation_failed: "Couldn't make sense of that photo — try a clearer, simpler shot, or log manually.",
  toast_photo_network_failed: 'Could not reach the photo analysis service — check your connection and try again.',
  toast_photo_unknown_failed: 'Something went wrong analyzing that photo — try again or log manually.',

  // ---- Large-entry confirmation ----
  confirm_large_entry: "That's {calories} kcal {description} — unusually high for one entry. Log it anyway?",
  large_entry_in_this_entry: 'in this entry',
  large_entry_burned: 'burned',
  large_entry_in_this_meal: 'in this meal',

  // ---- Gap Fixer ----
  fixer_screen_title: 'Gap Fixer',
  fixer_subtitle: "Realistic options that fit what's left of today's budget.",
  fixer_no_budget_left: "You've hit your target for today — nothing left to suggest, and that's fine.",
  fixer_no_combos_fit: "Nothing in the list fits what's left — try logging something small and simple instead.",
  fixer_remaining_summary: '{calories} kcal left · leaning toward {macro}',
  fixer_refresh_button: 'Show me other options',
  fixer_log_this_button: 'Log this',
  toast_logged_fixer_combo: 'Logged {name}',
  combo_greek_yogurt_berries: 'Greek yogurt with berries',
  combo_chicken_rice_bowl: 'Grilled chicken with rice',
  combo_protein_shake: 'Protein shake',
  combo_eggs_toast: 'Two eggs with toast',
  combo_cottage_cheese: 'Cottage cheese bowl',
  combo_tuna_crackers: 'Tuna with crackers',
  combo_banana_peanut_butter: 'Banana with peanut butter',
  combo_hummus_veggies: 'Hummus with vegetables',
  combo_oatmeal_fruit: 'Oatmeal with fruit',
  combo_nuts_mix: 'Mixed nuts',
  combo_turkey_wrap: 'Turkey wrap',
  combo_avocado_toast: 'Avocado toast',
  combo_salmon_veggies: 'Baked salmon with vegetables',
  combo_rice_cakes_pb: 'Rice cakes with peanut butter',
  combo_edamame: 'Steamed edamame',

  // ---- Flex Card ----
  flex_screen_title: 'Weekly Flex Card',
  flex_subtitle_current: "This week's card generates automatically each Monday — or tap refresh anytime.",
  flex_week_label: 'Week of {startDate}',
  flex_days_logged_label: 'days logged',
  flex_streak_label: '{count} day streak',
  flex_adherence_label: '{pct}% of target',
  flex_share_button: 'Save image',
  flex_refresh_button: 'Regenerate',
  flex_no_data: 'Log a few days this week to generate your card.',
  toast_flex_saved: 'Card saved to your downloads',

  // ---- Orbit header ----
  app_name_caps: 'MACROLOOP',
  orbit_sub_exercise_credit: '+{amount} from exercise',
  orbit_label_exercise: 'Kcal burned today',
  orbit_sub_exercise_count: '{count} logged today',
  orbit_label_weight_kg: 'Kg current weight',
  orbit_label_weight_lb: 'Lb current weight',
  orbit_label_protein_gap: 'G protein gap',
  orbit_sub_combos_found: '{count} combos found',
  orbit_label_days_logged: 'Days logged this week',
  orbit_sub_streak: '{count} day streak',

  // ---- Premium paywall ----
  paywall_title: 'MacroLoop Premium',
  paywall_hero_line: 'A formula guesses. An algorithm learns.',
  paywall_col_free: 'Free',
  paywall_col_premium: 'Premium',
  paywall_feature_algorithm: 'Daily target',
  paywall_free_algorithm: 'Static formula',
  paywall_premium_algorithm: 'Learns your metabolism',
  paywall_feature_photo: 'Photo scans',
  paywall_free_photo: '3 / month',
  paywall_premium_photo: 'Unlimited',
  paywall_price_placeholder: '$4.99',
  paywall_price_period: '/month',
  paywall_cancel_note: 'Cancel anytime from Settings.',
  paywall_checkout_button: 'Continue to checkout',
  paywall_secure_note: 'Secure checkout, handled by Stripe.',
  paywall_processing: 'Finishing up — this can take a few seconds…',
  paywall_dev_toggle_button: 'Developer: force premium on this account',
  toast_checkout_error: "Couldn't start checkout — check your connection and try again.",
  toast_checkout_success: "You're on Premium — your algorithm starts personalizing right away.",
  toast_checkout_cancelled: 'Checkout cancelled — no charge made.',
  toast_dev_premium_on: 'Premium forced on for this account (dev only).',
  toast_dev_premium_off: 'Premium forced off for this account (dev only).',
};

/**
 * Looks up a string by id with {placeholder} interpolation. Falls back
 * to a visible [[key]] marker (and a console warning) on a missing key,
 * so a typo shows up immediately during development instead of silently
 * rendering blank.
 */
export function t(key, params = {}) {
  const str = STRINGS[key];
  if (str === undefined) {
    console.warn(`Missing string: ${key}`);
    return `[[${key}]]`;
  }
  return str.replace(/\{(\w+)\}/g, (_, name) => (params[name] !== undefined ? params[name] : `{${name}}`));
}

/**
 * Applies data-i18n / data-i18n-placeholder / data-i18n-aria-label
 * attributes across a subtree (default: the whole document). Call once
 * at boot for the static markup; call again scoped to a container after
 * injecting new HTML that also carries these attributes.
 */
export function applyStrings(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  });
}
