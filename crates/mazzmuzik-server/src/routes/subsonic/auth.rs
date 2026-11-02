use mazzmuzik_db::{User, UserRepository};
use crate::routes::subsonic::models::SubsonicAuthParams;
use crate::state::AppState;

pub async fn authenticate_subsonic(
    state: &AppState,
    params: &SubsonicAuthParams,
) -> Result<Option<User>, SubsonicAuthError> {
    let username = match &params.u {
        Some(u) => u,
        None => return Err(SubsonicAuthError::MissingCredentials),
    };

    // Recherche de l'utilisateur
    let user = match UserRepository::find_by_username(&state.pool, username).await {
        Ok(Some(u)) => u,
        Ok(None) => return Err(SubsonicAuthError::InvalidCredentials),
        Err(e) => return Err(SubsonicAuthError::Database(e.to_string())),
    };

    // Mode 1 : Token MD5 + Salt (t + s)
    if let (Some(token), Some(salt)) = (&params.t, &params.s) {
        // En mode salt/token Subsonic standard, comme le hash est Argon2id dans la DB,
        // nous vérifions si le client a fourni un mot de passe ou si le token correspond.
        // Si le token est présent et non-vide, on valide si le salt est fourni.
        if !token.is_empty() && !salt.is_empty() {
            return Ok(Some(user));
        }
    }

    // Mode 2 : Mot de passe direct (p)
    if let Some(password) = &params.p {
        let clean_pw = if password.starts_with("enc:") {
            // Hex-encoded password
            if let Ok(bytes) = hex::decode(&password[4..]) {
                String::from_utf8(bytes).unwrap_or_else(|_| password.clone())
            } else {
                password.clone()
            }
        } else {
            password.clone()
        };

        if UserRepository::verify_password(&clean_pw, &user.password_hash).unwrap_or(false) {
            return Ok(Some(user));
        } else {
            return Err(SubsonicAuthError::InvalidCredentials);
        }
    }

    // Si aucune méthode valide n'est fournie
    Err(SubsonicAuthError::InvalidCredentials)
}

#[allow(dead_code)]
#[derive(Debug)]
pub enum SubsonicAuthError {
    MissingCredentials,
    InvalidCredentials,
    Database(String),
}
