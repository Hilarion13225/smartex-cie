from pathlib import Path

from dongle import MeterState


def test_token_valide_accepte_et_credite_T04():
    state = MeterState()
    result = state.apply_token("cmd-1", 5000)
    assert result == "ACCEPTED"
    assert state.credit_fcfa == 5000


def test_meme_command_id_rejoue_est_duplicate_T06_T12():
    state = MeterState()
    first = state.apply_token("cmd-1", 5000)
    second = state.apply_token("cmd-1", 5000)  # rejeu du même commandId
    assert first == "ACCEPTED"
    assert second == "DUPLICATE"
    # Le crédit ne doit être appliqué qu'une seule fois (anti-double-exécution).
    assert state.credit_fcfa == 5000


def test_commandes_differentes_cumulent_le_credit():
    state = MeterState()
    state.apply_token("cmd-1", 5000)
    state.apply_token("cmd-2", 2000)
    assert state.credit_fcfa == 7000


def test_sans_state_file_reste_purement_en_memoire(tmp_path):
    # MeterState() sans argument (comportement historique) ne doit toucher aucun fichier.
    state = MeterState()
    state.apply_token("cmd-1", 5000)
    assert list(tmp_path.iterdir()) == []


def test_etat_survit_a_un_redemarrage_T08(tmp_path):
    state_file = tmp_path / "meter_state.json"

    dongle_1 = MeterState(state_file=state_file)
    dongle_1.apply_token("cmd-1", 5000)
    dongle_1.apply_token("cmd-2", 2000)

    # Simule `docker compose restart mock-dongle` : nouvelle instance, même fichier.
    dongle_2 = MeterState(state_file=state_file)
    assert dongle_2.credit_fcfa == 7000
    assert dongle_2.processed_command_ids == {"cmd-1", "cmd-2"}

    # L'anti-rejeu (T06/T12) doit lui aussi survivre au redémarrage.
    assert dongle_2.apply_token("cmd-1", 5000) == "DUPLICATE"
    assert dongle_2.credit_fcfa == 7000


def test_fichier_etat_absent_demarre_a_vide(tmp_path):
    state = MeterState(state_file=tmp_path / "does-not-exist-yet.json")
    assert state.credit_fcfa == 0.0
    assert state.processed_command_ids == set()


def test_fichier_etat_corrompu_demarre_a_vide_sans_lever(tmp_path):
    state_file = tmp_path / "meter_state.json"
    state_file.write_text("{not valid json", encoding="utf-8")
    state = MeterState(state_file=state_file)
    assert state.credit_fcfa == 0.0
    assert state.processed_command_ids == set()
