import Header from "@/app/components/header";
import ChatSection from "./components/chat-section";

export default function Home() {
  return (
      <main className="flex min-h-screen flex-col items-center gap-10 pt-12 pb-24 px-24 background-gradient">
      <Header />
      <ChatSection />
    </main>
  );
}
