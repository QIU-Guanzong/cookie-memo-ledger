# Human-only final-step checklist

Use this only after the local app is running, Nightly is configured by its owner, and the owner has decided to use the signing path.

1. Check the displayed RPC endpoint is `https://rpc.cookiescan.io`.
2. Check the public address is the account you intend to use.
3. Read the memo text. It becomes public on Cookie Chain only if it is signed and sent. Do not include personal, account, wallet-recovery, or sensitive information.
4. Click **Prepare signing request** and confirm that the app says `Transaction-ready`; the Memo v1 transaction is still unsigned and only exists in browser memory.
5. Click **Request signature and send** only when the wallet owner is ready to decide in Nightly.
6. Inspect the Nightly prompt yourself. Verify the account, Memo v1 note, and any shown fee. Reject it if any detail is unexpected.
7. If you approve, wait for the app to show either `Confirmed` or `Failed`.
8. Open the signature in Cookiescan yourself. Do not treat a local UI message as independent proof of success.

Do not enter a seed phrase, private key, recovery phrase, password, or payment information into this app. It does not need any of them.
