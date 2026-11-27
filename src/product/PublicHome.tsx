import { Brain, ArrowUpRight, Briefcase, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Landing } from "./Landing";
import "./public-home.css";
import { appPath, homePath } from "../lib/paths";
export function PublicHome() {
  return (
    <div className="public-home">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header public-header">
        <div className="wrap header-inner">
          <a className="brand" href={homePath()} aria-label="InterviewAce home">
            <span>
              <Brain size={23} />
            </span>
            InterviewAce<span className="brand-period">.</span>
          </a>
          <nav aria-label="Public navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#hiring">For hiring teams</a>
          </nav>
          <div className="public-entry-actions">
            <Button asChild variant="ghost" size="sm">
              <a href={`${appPath("practice")}?auth=signin`}>
                <GraduationCap size={16} />
                Practice sign in
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`${appPath("hiring")}?auth=signin`}>
                <Briefcase size={16} />
                Hiring sign in
                <ArrowUpRight size={14} />
              </a>
            </Button>
          </div>
        </div>
      </header>
      <main id="main">
        <Landing
          start={() => window.location.assign(appPath("practice"))}
          hire={() => window.location.assign(appPath("hiring"))}
        />
      </main>
    </div>
  );
}
