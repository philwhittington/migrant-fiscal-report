#!/bin/bash
# Agentic orchestrator for migrant-fiscal-report
# Reads PLAN.md, finds next ready task(s), invokes claude CLI for each.
# Supports parallel execution for tasks marked parallel=yes in the same phase.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
AGENT_DIR="$PROJECT_DIR/.agent"
PLAN="$AGENT_DIR/PLAN.md"
TASKS_DIR="$PROJECT_DIR/tasks"
LOGS_DIR="$AGENT_DIR/logs"

mkdir -p "$LOGS_DIR"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${BLUE}[orchestrator]${NC} $1"; }
success() { echo -e "${GREEN}[orchestrator]${NC} $1"; }
warn() { echo -e "${YELLOW}[orchestrator]${NC} $1"; }
error() { echo -e "${RED}[orchestrator]${NC} $1"; }

# Parse PLAN.md and extract task table rows
parse_plan() {
    # Skip header rows, extract pipe-delimited fields
    grep '^\| P' "$PLAN" | while IFS='|' read -r _ id task deps status phase parallel _; do
        id=$(echo "$id" | xargs)
        task=$(echo "$task" | xargs)
        deps=$(echo "$deps" | xargs)
        status=$(echo "$status" | xargs)
        phase=$(echo "$phase" | xargs)
        parallel=$(echo "$parallel" | xargs)
        echo "$id|$task|$deps|$status|$phase|$parallel"
    done
}

# Check if all dependencies of a task are done
deps_satisfied() {
    local deps="$1"
    if [ "$deps" = "—" ] || [ "$deps" = "-" ] || [ -z "$deps" ]; then
        return 0
    fi
    IFS=',' read -ra dep_array <<< "$deps"
    for dep in "${dep_array[@]}"; do
        dep=$(echo "$dep" | xargs)
        local dep_status
        dep_status=$(parse_plan | grep "^$dep|" | cut -d'|' -f4)
        if [ "$dep_status" != "done" ]; then
            return 1
        fi
    done
    return 0
}

# Update task status in PLAN.md
update_status() {
    local task_id="$1"
    local new_status="$2"
    # Use sed to replace the status field for the matching task ID
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/| $task_id |\\(.*\\)| [a-z]* |\\(.*\\)|/| $task_id |\1| $new_status |\2|/" "$PLAN"
    else
        sed -i "s/| $task_id |\\(.*\\)| [a-z]* |\\(.*\\)|/| $task_id |\1| $new_status |\2|/" "$PLAN"
    fi
}

# Build the prompt for a task
build_prompt() {
    local task_id="$1"
    local workfile="$TASKS_DIR/${task_id}-*.md"

    # Find the workfile (glob)
    local wf
    wf=$(ls $workfile 2>/dev/null | head -1)
    if [ -z "$wf" ]; then
        error "No workfile found for $task_id at $workfile"
        return 1
    fi

    # Assemble: SOUL + SCRATCHPAD + WORKFILE
    echo "# Agent context"
    echo ""
    cat "$AGENT_DIR/SOUL.md"
    echo ""
    echo "---"
    echo ""
    echo "# Current working state"
    echo ""
    cat "$AGENT_DIR/SCRATCHPAD.md"
    echo ""
    echo "---"
    echo ""
    echo "# Task to execute"
    echo ""
    cat "$wf"
}

# Run a single task
run_task() {
    local task_id="$1"
    local task_name="$2"

    log "Starting task $task_id: $task_name"
    update_status "$task_id" "running"

    local prompt
    prompt=$(build_prompt "$task_id")
    if [ $? -ne 0 ]; then
        error "Failed to build prompt for $task_id"
        update_status "$task_id" "failed"
        return 1
    fi

    local logfile="$LOGS_DIR/${task_id}.log"
    local start_time
    start_time=$(date +%s)

    # Invoke claude CLI
    cd "$PROJECT_DIR"
    echo "$prompt" | claude --print \
        --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
        2>&1 | tee "$logfile"

    local exit_code=${PIPESTATUS[0]}
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))

    if [ $exit_code -eq 0 ]; then
        update_status "$task_id" "done"
        success "Task $task_id completed in ${duration}s"

        # Append to SCRATCHPAD
        echo "" >> "$AGENT_DIR/SCRATCHPAD.md"
        echo "## Task $task_id completed ($(date '+%Y-%m-%d %H:%M'))" >> "$AGENT_DIR/SCRATCHPAD.md"
        echo "- Duration: ${duration}s" >> "$AGENT_DIR/SCRATCHPAD.md"
        echo "- Log: logs/${task_id}.log" >> "$AGENT_DIR/SCRATCHPAD.md"
    else
        update_status "$task_id" "failed"
        error "Task $task_id FAILED (exit code $exit_code) after ${duration}s"
        error "Check log: $logfile"
        return 1
    fi
}

# Main loop
main() {
    log "Starting orchestrator for migrant-fiscal-report"
    log "Project dir: $PROJECT_DIR"
    log "Plan: $PLAN"
    echo ""

    local iteration=0
    local max_iterations=50  # Safety limit

    while [ $iteration -lt $max_iterations ]; do
        iteration=$((iteration + 1))

        # Find all ready tasks whose deps are satisfied
        local ready_tasks=()
        local ready_names=()
        local ready_parallel=()

        while IFS='|' read -r id task deps status phase parallel; do
            if [ "$status" = "ready" ] && deps_satisfied "$deps"; then
                ready_tasks+=("$id")
                ready_names+=("$task")
                ready_parallel+=("$parallel")
            fi
        done < <(parse_plan)

        # Check if there are any non-done tasks left
        local remaining
        remaining=$(parse_plan | grep -v '|done|' | grep -v '|failed|' | wc -l | xargs)

        if [ "$remaining" -eq 0 ]; then
            echo ""
            success "========================================="
            success "All tasks complete!"
            success "========================================="
            break
        fi

        if [ ${#ready_tasks[@]} -eq 0 ]; then
            # Check if there are blocked tasks
            local blocked
            blocked=$(parse_plan | grep '|blocked|' | wc -l | xargs)
            if [ "$blocked" -gt 0 ]; then
                # Unblock tasks whose deps are now done
                while IFS='|' read -r id task deps status phase parallel; do
                    if [ "$status" = "blocked" ] && deps_satisfied "$deps"; then
                        update_status "$id" "ready"
                        log "Unblocked task $id: $task"
                    fi
                done < <(parse_plan)
                continue
            else
                warn "No ready or blocked tasks — possible deadlock. Remaining: $remaining"
                break
            fi
        fi

        # Check if we can run tasks in parallel
        local first_parallel="${ready_parallel[0]}"
        if [ "$first_parallel" = "yes" ] && [ ${#ready_tasks[@]} -gt 1 ]; then
            log "Running ${#ready_tasks[@]} tasks in parallel..."
            local pids=()
            for i in "${!ready_tasks[@]}"; do
                run_task "${ready_tasks[$i]}" "${ready_names[$i]}" &
                pids+=($!)
            done
            # Wait for all parallel tasks
            local all_ok=true
            for pid in "${pids[@]}"; do
                if ! wait "$pid"; then
                    all_ok=false
                fi
            done
            if [ "$all_ok" = false ]; then
                error "One or more parallel tasks failed. Stopping."
                break
            fi
        else
            # Run first ready task sequentially
            if ! run_task "${ready_tasks[0]}" "${ready_names[0]}"; then
                error "Task ${ready_tasks[0]} failed. Stopping."
                break
            fi
        fi
    done

    echo ""
    log "Orchestrator finished after $iteration iterations."
    log "Final plan state:"
    echo ""
    grep '^\| P' "$PLAN" | while IFS='|' read -r _ id task deps status phase parallel _; do
        id=$(echo "$id" | xargs)
        status=$(echo "$status" | xargs)
        case "$status" in
            done)    echo -e "  ${GREEN}[done]${NC}    $id" ;;
            failed)  echo -e "  ${RED}[FAILED]${NC}  $id" ;;
            ready)   echo -e "  ${YELLOW}[ready]${NC}   $id" ;;
            blocked) echo -e "  ${BLUE}[blocked]${NC} $id" ;;
            *)       echo "  [$status]  $id" ;;
        esac
    done
}

main "$@"
