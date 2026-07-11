# Coordinator control projects

## Readable Summary

AX renders two legacy saved Codex projects from this source. They support
`linear-codex-v1` migration and rollback until the corresponding Roots activate
in the Cloudflare workspace. Delivery hosts the old delivery coordinators.
Operations hosts the old Executive Operations Assistant. Both projects use
read-only local permissions and a generated fail-closed tool-policy hook.

The generated runtime targets are not source repositories. `ax coordinators
sync` replaces only the two exact configured child directories and refuses
unmanaged content at either target.
