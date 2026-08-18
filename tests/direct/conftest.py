"""Install the test-local Windows compatibility fix for genlayer-test 0.29.2."""

import os
import tempfile


if os.name == "nt":
    from gltest.direct import loader
    from gltest.direct.vm import VMContext

    if not getattr(loader, "_consensusbrief_windows_fix", False):

        def _inject_message_windows_safe(vm: VMContext) -> None:
            from genlayer.py import calldata
            from genlayer.py.types import Address

            sender = Address(vm.sender) if isinstance(vm.sender, bytes) else vm.sender
            contract = (
                Address(vm._contract_address)
                if isinstance(vm._contract_address, bytes)
                else vm._contract_address
            )
            origin = Address(vm.origin) if isinstance(vm.origin, bytes) else vm.origin
            encoded = calldata.encode(
                {
                    "contract_address": contract,
                    "sender_address": sender,
                    "origin_address": origin,
                    "stack": [],
                    "value": vm._value,
                    "datetime": vm._datetime,
                    "is_init": False,
                    "chain_id": vm._chain_id,
                    "entry_kind": 0,
                    "entry_data": b"",
                    "entry_stage_data": None,
                }
            )
            fd, path = tempfile.mkstemp(prefix="consensusbrief-gltest-")
            try:
                os.write(fd, encoded)
                os.lseek(fd, 0, os.SEEK_SET)
                vm._original_stdin_fd = os.dup(0)
                os.dup2(fd, 0)
                vm._consensusbrief_stdin_path = path
            finally:
                os.close(fd)

        _original_cleanup = VMContext._cleanup_after_deactivate

        def _cleanup_windows_tempfile(self: VMContext) -> None:
            _original_cleanup(self)
            path = getattr(self, "_consensusbrief_stdin_path", None)
            if path:
                try:
                    os.unlink(path)
                except FileNotFoundError:
                    pass
                self._consensusbrief_stdin_path = None

        loader._inject_message_to_fd0 = _inject_message_windows_safe
        VMContext._cleanup_after_deactivate = _cleanup_windows_tempfile
        loader._consensusbrief_windows_fix = True
