import { loginWithGitHub } from "../utils/api";
import {
  Github,
  Zap,
  Shield,
  Terminal,
  Bot,
  GitPullRequest,
} from "lucide-react";

export default function Login() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden font-poppins text-white">
      {/* Better Dark Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1761839257658-23502c67f6d5?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDF8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D)",
        }}
      />

      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/65" />

      {/* Right Gradient */}
      <div className="absolute inset-0 bg-gradient-to-l from-black via-black/60 to-transparent" />

      {/* Top Right GitHub CTA */}
      <div className="relative z-10 flex justify-between px-8 top-5">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500 shadow-md shadow-green-500/20">
            <Zap size={18} fill="white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">DevNex</h2>
            <p className="text-xs text-gray-400">Browser IDE + AI Agent</p>
          </div>
        </div>
        <button
          onClick={loginWithGitHub}
          className="group flex items-center h-12 gap-2 rounded-lg border border-white/10 bg-white/10 px-5  text-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-green-500 hover:shadow-lg hover:shadow-green-500/20"
        >
          <Github size={16} />
          <span>GitHub Login</span>
        </button>
      </div>

      {/* Left Content */}
      <div className="relative z-10 flex min-h-[85vh] items-center px-28">
        <div className="max-w-xl">
          {/* Logo */}

          {/* Heading */}
          <h1 className="text-4xl font-bold leading-tight">
            Build Faster.
            <br />
            <span className="text-green-400">Debug Smarter.</span>
          </h1>

          {/* Paragraph */}
          <p className="mt-4 max-w-lg text-sm leading-6 text-gray-300">
            AI-powered coding workspace with PR review, CI/CD monitoring,
            deployment checks and live terminal access.
          </p>

          {/* Buttons */}
          <div className="mt-8 flex gap-3">
            <button
              onClick={loginWithGitHub}
              className="rounded-lg bg-green-500 px-6 py-3 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:bg-green-600 hover:shadow-xl hover:shadow-green-500/30"
            >
              Start Coding
            </button>

            <button className="rounded-lg border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold backdrop-blur-md transition-all duration-300 hover:bg-white/10 hover:-translate-y-0.5">
              View Features
            </button>
          </div>

          {/* Scope Tags */}
          <div className="mt-6">
            <p className="mb-2 text-xs text-gray-400">Required scopes:</p>
            <div className="flex flex-wrap gap-2">
              {["repo", "workflow", "read:user"].map((scope) => (
                <span
                  key={scope}
                  className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300"
                >
                  {scope}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Feature Pills */}
      {/* Floating Feature Pills */}
      {/* Floating Animated Feature Cluster */}
      {/* Orbiting Feature Pills */}
      {/* Toast Feature Stack */}
      <div className="absolute right-32 top-1/2 z-10 flex w-[210px] -translate-y-1/2 flex-col gap-4">
        {[
          "AI Bug Scanner",
          "Smart PR Review",
          "CI/CD Monitoring",
          "Live Terminal Access",
          "GitHub Agent Sync",
        ].map((item, i) => (
          <div
            key={item}
            className="animate-toastPop rounded-xl border border-white/10 bg-[#1f2937]/85 px-5 py-3 text-sm font-medium text-green-400 backdrop-blur-md"
            style={{
              animationDelay: `${i * 1.3}s`,
              boxShadow: "0 0 18px rgba(34,197,94,0.12)",
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
