export default function ChatRedirect() {
  if (typeof window !== 'undefined') {
    window.location.replace('/debate');
  }
  return null;
}