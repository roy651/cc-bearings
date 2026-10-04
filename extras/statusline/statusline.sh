#!/bin/bash
# Two-line Claude Code status line:
#   [Model ◕ effort] │ dir git:(branch)
#   Context ███░░░░░░░ 5% │ Usage █░░░░░░░░░ 12% (resets in 3h 14m) · 7d 3%

input=$(cat)
field() { echo "$input" | jq -r "$1 // empty"; }

dim=$'\e[38;5;244m'
amber=$'\e[38;5;221m'
green=$'\e[38;5;149m'
blue=$'\e[38;5;111m'
pink=$'\e[38;5;218m'
empty_cell=$'\e[38;5;238m'
reset=$'\e[0m'
sep=" ${dim}│${reset} "

# Prints a 10-cell bar for a percentage, filled cells in the given color.
bar() {
  local percent=$1 color=$2 filled cells="" i
  filled=$(( (percent + 5) / 10 ))
  (( filled > 10 )) && filled=10
  for (( i = 0; i < 10; i++ )); do
    if (( i < filled )); then cells+="${color}█"; else cells+="${empty_cell}█"; fi
  done
  echo "${cells}${reset}"
}

model=$(field '.model.display_name')
effort=$(field '.effort.level')
cwd=$(field '.workspace.current_dir')
[ -z "$cwd" ] && cwd=$(field '.cwd')
context_used=$(field '.context_window.used_percentage')
five_hour_used=$(field '.rate_limits.five_hour.used_percentage')
five_hour_resets=$(field '.rate_limits.five_hour.resets_at')
seven_day_used=$(field '.rate_limits.seven_day.used_percentage')

# Line 1: model, effort, directory, git branch
line1="[${model}"
[ -n "$effort" ] && line1+=" ◕ ${effort}"
line1+="]"
if [ -n "$cwd" ]; then
  line1+="${sep}${amber}$(basename "$cwd")${reset}"
  branch=$(git --no-optional-locks -C "$cwd" branch --show-current 2>/dev/null)
  [ -n "$branch" ] && line1+=" git:(${branch})"
fi

# Line 2: context bar, 5-hour usage bar with reset time, 7-day figure
line2=""
if [ -n "$context_used" ]; then
  percent=$(printf '%.0f' "$context_used")
  line2+="${dim}Context${reset} $(bar "$percent" "$green") ${green}${percent}%${reset}"
fi
if [ -n "$five_hour_used" ]; then
  percent=$(printf '%.0f' "$five_hour_used")
  [ -n "$line2" ] && line2+="$sep"
  line2+="${dim}Usage${reset} $(bar "$percent" "$blue") ${blue}${percent}%${reset}"
  if [[ "$five_hour_resets" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
    seconds_left=$(( ${five_hour_resets%.*} - $(date +%s) ))
    if (( seconds_left > 0 )); then
      line2+=" (resets in $(( seconds_left / 3600 ))h $(( seconds_left % 3600 / 60 ))m)"
    fi
  fi
fi
if [ -n "$seven_day_used" ]; then
  percent=$(printf '%.0f' "$seven_day_used")
  [ -n "$line2" ] && line2+="$sep"
  line2+="${dim}7d${reset} $(bar "$percent" "$pink") ${pink}${percent}%${reset}"
fi

echo "$line1"
if [ -n "$line2" ]; then
  echo "$line2"
fi
