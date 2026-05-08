from modules import profiler, cleaner, validator, normalizer
from modules import metadata, reporter, notifier, reader, loader

PIPELINE = [reader, profiler, cleaner, validator,
            normalizer, metadata, reporter, notifier, loader]

def run_pipeline(source: dict) -> dict:
    ctx = {"source": source, "errors": [], "quality": 0}
    for step in PIPELINE:
        ctx = step.run(ctx)
    return ctx

if __name__ == "__main__":
    import json, sys
    result = run_pipeline(json.loads(sys.stdin.read()))
    print(json.dumps(result, indent=2))
