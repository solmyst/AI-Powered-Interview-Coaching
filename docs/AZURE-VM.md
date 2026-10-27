# Azure VM deployment

This deployment keeps the application on one Ubuntu VM. Browser camera analysis remains on each candidate's device, while completed spoken turns are sent through the VM to AssemblyAI for English/Hindi transcription.

## Choose the model path first

### Recommended pilot: local Ollama on an NVIDIA GPU VM

Use an Azure N-series VM with enough GPU memory for the selected model. The existing `qwen2.5:7b-instruct` configuration is suitable for a small pilot, but actual throughput must be measured on the selected SKU. The application talks to Ollama over loopback and never exposes port 11434.

This is the option that actually runs the interview model locally on your VM. It does not require an NVIDIA API key.

### Lower-operations alternative: hosted NVIDIA API

Use an ordinary CPU VM and configure `AI_PROVIDER=nvidia`, `NVIDIA_API_KEY`, and `NVIDIA_MODEL`. The model runs on NVIDIA's hosted service, not locally on the Azure VM.

### NVIDIA NIM on the VM

NIM is possible on a compatible NVIDIA GPU VM, but it is a different deployment from the hosted NVIDIA API. NIM uses Docker, NVIDIA Container Toolkit, compatible drivers and enough VRAM for the chosen profile. The current application is already production-tested with Ollama locally, so NIM should be a later provider adapter rather than the first deployment.

## Required information

Before deploying, record:

- Azure VM resource group and VM name.
- VM size/SKU and the output of `nvidia-smi` (or confirmation that it is CPU-only).
- Ubuntu version.
- SSH username and local private-key path. Never paste the private key into chat.
- A domain name whose DNS can point to the deployment.

A domain and valid HTTPS certificate are required for camera and microphone access outside localhost. Browsers expose `navigator.mediaDevices` only in a secure context.

## Azure network

- Restrict SSH/22 to the administrator's IP.
- Allow public TCP 80 and 443 only.
- Do not expose Node port 3001, Ollama port 11434, SQLite, or an NVIDIA NIM port publicly.
- For a public production launch, prefer Azure Application Gateway or Front Door with WAF instead of serving directly from a VM public IP.

## GPU setup

For an Azure N-series VM, install the NVIDIA GPU Driver Extension from **VM → Extensions → Add → NVIDIA GPU Driver Extension**, then reboot if requested and verify:

```sh
nvidia-smi
```

Install Ollama using its official Linux installer and pull the model:

```sh
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl enable --now ollama
ollama pull qwen2.5:7b-instruct
curl http://127.0.0.1:11434/api/tags
```

Keep Ollama bound to loopback. Confirm GPU use during a model request with `watch -n 1 nvidia-smi`.

## Application installation

Install Node 24 LTS, Git, Nginx and Certbot using maintained packages for the Ubuntu release. Then place the committed source at `/opt/interviewace` and run:

```sh
cd /opt/interviewace
npm ci
npm run setup:vision
npm run lint
npm run typecheck
npm test
npm run build
sudo useradd --system --home /opt/interviewace --shell /usr/sbin/nologin interviewace
sudo mkdir -p /var/lib/interviewace
sudo chown -R interviewace:interviewace /opt/interviewace /var/lib/interviewace
```

Create `/etc/interviewace.env` (mode `600`) for local Ollama:

```dotenv
NODE_ENV=production
PORT=3001
HOST=127.0.0.1
APP_ORIGIN=https://interview.example.com
DATABASE_PATH=/var/lib/interviewace/interviewace.db
AI_PROVIDER=ollama
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:7b-instruct
AI_TIMEOUT_MS=120000
DAILY_INTERVIEW_LIMIT=5
```

For hosted NVIDIA instead, replace the provider section:

```dotenv
AI_PROVIDER=nvidia
NVIDIA_API_KEY=configure_on_the_vm_only
NVIDIA_MODEL=the_exact_catalog_model_id
ASSEMBLYAI_API_KEY=configure_on_the_vm_only
ASSEMBLYAI_MODEL=universal-3-5-pro
ELEVENLABS_API_KEY=configure_on_the_vm_only
ELEVENLABS_MODEL=eleven_v4_turbo
ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL
```

Install and start the service:

```sh
sudo cp deploy/interviewace.service /etc/systemd/system/interviewace.service
sudo systemctl daemon-reload
sudo systemctl enable --now interviewace
sudo systemctl status interviewace
curl http://127.0.0.1:3001/api/health
```

## HTTPS proxy

Replace `interview.example.com` in `deploy/nginx-interviewace.conf`, install it, and issue a real certificate:

```sh
sudo cp deploy/nginx-interviewace.conf /etc/nginx/sites-available/interviewace
sudo ln -s /etc/nginx/sites-available/interviewace /etc/nginx/sites-enabled/interviewace
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d interview.example.com
```

After HTTPS is active, verify the camera/microphone preflight from the public domain. Testing through a raw `http://` IP address will not provide browser camera/microphone APIs.

## Deployment verification

```sh
curl https://interview.example.com/api/health
sudo journalctl -u interviewace -n 100 --no-pager
sudo journalctl -u ollama -n 100 --no-pager
```

Then run a disposable three-question interview in the browser: grant both permissions during preflight, confirm the preview, join, answer aloud, pause, verify the follow-up, finish, and delete the test account.

## Rollback

Keep the previous Git commit or source archive. To roll back code without touching the database: stop the service, restore the previous source, run `npm ci && npm run setup:vision && npm run build`, and restart. Back up `/var/lib/interviewace` before deployment. SQLite supports one application instance; do not add replicas behind a load balancer without migrating the database and locks.

## Official references

- Azure NVIDIA GPU extension: https://learn.microsoft.com/en-us/azure/virtual-machines/extensions/hpccompute-gpu-linux
- Azure N-series Linux drivers: https://learn.microsoft.com/en-us/azure/virtual-machines/linux/n-series-driver-setup
- Azure secure ingress guidance: https://learn.microsoft.com/en-us/azure/networking/design-guide/internet-ingress
- Ollama Linux installation: https://docs.ollama.com/linux
- Ollama NVIDIA support: https://docs.ollama.com/gpu
- NVIDIA NIM prerequisites: https://docs.nvidia.com/nim/large-language-models/2.0.0/get-started/prerequisites.html
- Browser camera/microphone security requirements: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
