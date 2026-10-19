import './styles.css';

const statusCopy = document.querySelector<HTMLElement>('#status-copy');

if (statusCopy) {
  statusCopy.textContent =
    'Fixture loading and deterministic analysis will appear here. For now, this shell confirms the local, offline runtime is ready.';
}
