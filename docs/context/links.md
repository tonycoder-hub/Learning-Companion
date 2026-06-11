# Learning Companion Links

Updated: 2026-06-11

## Mew

- Server: `https://mew.bytedance.net`
- Personal workspace: `jinzheng.architect's Space`
- Workspace ID: `07c4dced-30dd-4f8c-947b-f0eae3c9d798`
- Tracking issue: `Learning Companion / Go 继续迭代`
- Issue ID: `b51a1223-bbf1-43ae-8e95-2e1785064935`
- Issue status at setup: `todo`

The Mew issue is a handoff container. No Mew run, chat, automation, service restart, or daemon change was started for this project.

## Project Checkout

- `.21` host: `jinzheng.architect@10.37.126.21`
- `.21` workdir: `/data00/home/jinzheng.architect/mew-projects/learning-companion`
- Entry doc: `docs/mew-handoff.md`
- TODO doc: `docs/context/todo.md`

## Future Run Shape

Use this only when the user explicitly asks Mew to continue implementation:

```bash
mew run create \
  --server https://mew.bytedance.net \
  --workspace-id 07c4dced-30dd-4f8c-947b-f0eae3c9d798 \
  --source-type issue \
  --source-id b51a1223-bbf1-43ae-8e95-2e1785064935 \
  --agent-id a745b5cf-888f-4b76-9818-85d9e0f96ff5 \
  --trigger manual \
  --permission-mode plan \
  --workdir /data00/home/jinzheng.architect/mew-projects/learning-companion
```

Keep permission mode as `plan` unless the user explicitly authorizes a broader mode in the current turn.
