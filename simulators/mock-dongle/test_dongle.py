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
